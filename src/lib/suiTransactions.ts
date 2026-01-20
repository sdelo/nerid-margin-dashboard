import { Transaction } from "@mysten/sui/transactions";
import type { PaginatedCoins, SuiClient } from "@mysten/sui/client";
import { normalizeStructTag } from "@mysten/sui/utils";

import { supply, withdraw, mintSupplierCap } from "../contracts/deepbook_margin/deepbook_margin/margin_pool";
import { ONE_BILLION, GAS_AMOUNT_MIST } from "../constants";


type DepositOptions = {
  amount: bigint;
  owner: string;
  coinType: string;
  poolId: string;
  registryId: string;
  referralId?: string;
  poolType: string;
  suiClient: SuiClient;
};

type WithdrawOptions = {
  poolId: string;
  registryId: string;
  poolType: string;
  owner: string;
  suiClient: SuiClient;
};

type WithdrawAmountOptions = {
  amount: bigint;
  poolId: string;
  registryId: string;
  poolType: string;
  owner: string;
  suiClient: SuiClient;
};

async function getPackageId(client: SuiClient, poolId: string): Promise<string> {
  const pool = await client.getObject({
    id: poolId,
    options: { showType: true },
  });
  if (!pool.data?.type) throw new Error("Pool type not found");
  return pool.data.type.split("::")[0];
}

async function getSupplierCapId(
  client: SuiClient,
  owner: string,
  packageId: string
): Promise<string | undefined> {
  const capType = `${packageId}::margin_pool::SupplierCap`;
  const caps = await client.getOwnedObjects({
    owner,
    filter: { StructType: capType },
  });
  return caps.data[0]?.data?.objectId;
}

export async function buildDepositTransaction({
  amount,
  owner,
  coinType,
  poolId,
  registryId,
  referralId,
  poolType,
  suiClient,
}: DepositOptions) {
  const tx = new Transaction();
  tx.setSender(owner);

  // Get coins for the asset we're depositing
  const coins: PaginatedCoins = await suiClient.getCoins({
    owner,
    coinType,
    limit: 200,
  });

  if (!coins.data.length) {
    throw new Error("No available balance to deposit");
  }

  let coinForDeposit;

  const isSui = normalizeStructTag(coinType) === normalizeStructTag("0x2::sui::SUI");

  // For SUI deposits, use the gas coin
  if (isSui) {
    const suiCoins = await suiClient.getCoins({
      owner,
      coinType: "0x2::sui::SUI",
      limit: 200,
    });
    
    // Calculate total SUI balance
    const totalSuiBalance = suiCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
    const gasAmount = BigInt(GAS_AMOUNT_MIST); // 0.2 SUI for gas
    const depositAmount = amount;
    const totalNeeded = depositAmount + gasAmount;
    
    if (totalSuiBalance < totalNeeded) {
      throw new Error(`Insufficient SUI balance. Need ${Number(totalNeeded) / ONE_BILLION} SUI but have ${Number(totalSuiBalance) / ONE_BILLION} SUI.`);
    }
    
    // Use gas coin for deposit
    [coinForDeposit] = tx.splitCoins(tx.gas, [amount]);
  } else {
    // For non-SUI deposits, split from the specific coin
    const source = tx.object(coins.data[0].coinObjectId);
    [coinForDeposit] = tx.splitCoins(source, [amount]);
  }

  const referralArg = referralId
    ? tx.pure.option("address", referralId)
    : tx.pure.option("address", null);

  // SupplierCap handling
  const packageId = await getPackageId(suiClient, poolId);
  const existingCap = await getSupplierCapId(suiClient, owner, packageId);
  let capArg;

  if (existingCap) {
    capArg = tx.object(existingCap);
  } else {
    [capArg] = mintSupplierCap({
      package: packageId,
      arguments: { registry: tx.object(registryId) }
    })(tx);
  }

  supply({
    package: packageId,
    arguments: {
      self: tx.object(poolId),
      registry: tx.object(registryId),
      supplierCap: capArg,
      coin: coinForDeposit,
      referral: referralArg,
    },
    typeArguments: [poolType],
  })(tx);

  if (!existingCap) {
    tx.transferObjects([capArg], owner);
  }

  // Set gas budget to 0.5 SUI
  tx.setGasBudget(500_000_000n);

  // Explicitly set gas payment for SUI deposits
  if (isSui) {
    const suiCoins = await suiClient.getCoins({
      owner,
      coinType: "0x2::sui::SUI",
      limit: 200,
    });
    
    // Find a coin that covers deposit amount + gas budget
    const totalNeeded = amount + 500_000_000n;
    const gasCoin = suiCoins.data.find(c => BigInt(c.balance) >= totalNeeded);
    
    if (gasCoin) {
      tx.setGasPayment([{
        objectId: gasCoin.coinObjectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      }]);
    } else {
      // If no single coin is enough, use all coins
      const paymentCoins = suiCoins.data.map(c => ({
        objectId: c.coinObjectId,
        version: c.version,
        digest: c.digest,
      }));
      tx.setGasPayment(paymentCoins);
    }
  } else {
    // For non-SUI deposits, get SUI coins for gas
    const suiCoins = await suiClient.getCoins({
      owner,
      coinType: "0x2::sui::SUI",
      limit: 200,
    });
    
    if (suiCoins.data.length > 0) {
      const gasCoin = suiCoins.data[0];
      tx.setGasPayment([{
        objectId: gasCoin.coinObjectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      }]);
    }
  }

  return tx;
}

export async function buildWithdrawTransaction({
  amount,
  poolId,
  registryId,
  poolType,
  owner,
  suiClient,
}: WithdrawAmountOptions) {
  const tx = new Transaction();
  tx.setSender(owner);

  // SupplierCap handling - user MUST have an existing cap to withdraw
  const packageId = await getPackageId(suiClient, poolId);
  const existingCap = await getSupplierCapId(suiClient, owner, packageId);

  if (!existingCap) {
    throw new Error("No SupplierCap found. You need to have deposited to this pool before you can withdraw.");
  }

  const capArg = tx.object(existingCap);

  const [withdrawnCoin] = withdraw({
    package: packageId,
    arguments: {
      self: tx.object(poolId),
      registry: tx.object(registryId),
      supplierCap: capArg,
      amount: tx.pure.option("u64", amount),
    },
    typeArguments: [poolType],
  })(tx);

  // Transfer the withdrawn coin to the owner
  tx.transferObjects([withdrawnCoin], owner);

  // Set gas budget to 0.5 SUI
  tx.setGasBudget(500_000_000n);

  // Explicitly set gas payment
  const suiCoins = await suiClient.getCoins({
    owner,
    coinType: "0x2::sui::SUI",
    limit: 200,
  });
  
  if (suiCoins.data.length > 0) {
    const gasCoin = suiCoins.data[0];
    tx.setGasPayment([{
      objectId: gasCoin.coinObjectId,
      version: gasCoin.version,
      digest: gasCoin.digest,
    }]);
  }

  return tx;
}

export async function buildWithdrawAllTransaction({
  poolId,
  registryId,
  poolType,
  owner,
  suiClient,
}: WithdrawOptions) {
  const tx = new Transaction();
  tx.setSender(owner);

  // SupplierCap handling - user MUST have an existing cap to withdraw
  const packageId = await getPackageId(suiClient, poolId);
  const existingCap = await getSupplierCapId(suiClient, owner, packageId);

  if (!existingCap) {
    throw new Error("No SupplierCap found. You need to have deposited to this pool before you can withdraw.");
  }

  const capArg = tx.object(existingCap);

  const [withdrawnCoin] = withdraw({
    package: packageId,
    arguments: {
      self: tx.object(poolId),
      registry: tx.object(registryId),
      supplierCap: capArg,
      amount: tx.pure.option("u64", null),
    },
    typeArguments: [poolType],
  })(tx);

  // Transfer the withdrawn coin to the owner
  tx.transferObjects([withdrawnCoin], owner);

  // Set gas budget to 0.5 SUI
  tx.setGasBudget(500_000_000n);

  // Explicitly set gas payment
  const suiCoins = await suiClient.getCoins({
    owner,
    coinType: "0x2::sui::SUI",
    limit: 200,
  });
  
  if (suiCoins.data.length > 0) {
    const gasCoin = suiCoins.data[0];
    tx.setGasPayment([{
      objectId: gasCoin.coinObjectId,
      version: gasCoin.version,
      digest: gasCoin.digest,
    }]);
  }

  return tx;
}
