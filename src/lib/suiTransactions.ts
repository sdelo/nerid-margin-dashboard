import { Transaction } from "@mysten/sui/transactions";
import type { PaginatedCoins, SuiClient } from "@mysten/sui/client";
import { normalizeStructTag } from "@mysten/sui/utils";
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";

import { supply, withdraw, mintSupplierCap } from "../contracts/deepbook_margin/deepbook_margin/margin_pool";
import { liquidate } from "../contracts/deepbook_margin/deepbook_margin/margin_manager";
import { ONE_BILLION, GAS_AMOUNT_MIST } from "../constants";
import { CONTRACTS, PYTH_PRICE_FEEDS, type NetworkType } from "../config/contracts";
import type { AtRiskPosition } from "../hooks/useAtRiskPositions";


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

// ============================================================================
// LIQUIDATION TRANSACTION BUILDER
// ============================================================================

export type LiquidateTransactionOptions = {
  position: AtRiskPosition;
  owner: string;
  network: NetworkType;
  suiClient: SuiClient;
  /** Amount to repay in smallest units. If not provided, uses max available balance */
  repayAmount?: bigint;
};

/**
 * Fetch fresh price updates from Pyth Hermes API
 * Returns the price update data as Buffer arrays that can be passed to updatePriceFeeds
 */
async function fetchPythPriceUpdates(): Promise<Buffer[]> {
  const priceIds = [
    PYTH_PRICE_FEEDS.SUI_USD.replace('0x', ''),
    PYTH_PRICE_FEEDS.USDC_USD.replace('0x', ''),
  ];

  const response = await fetch(
    `https://hermes.pyth.network/v2/updates/price/latest?` +
    priceIds.map(id => `ids[]=${id}`).join('&') +
    `&encoding=base64&parsed=false`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Pyth prices: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.binary?.data || data.binary.data.length === 0) {
    throw new Error('No price update data from Hermes');
  }

  // Convert base64 strings to Buffer
  // Buffer.from works in modern browsers with the buffer polyfill that comes with vite
  return data.binary.data.map((base64: string) => Buffer.from(base64, 'base64'));
}

/**
 * Build a transaction to liquidate an underwater margin position.
 * 
 * The liquidator needs to provide the repay coin (the asset being borrowed)
 * and will receive collateral + liquidation bonus in return.
 * 
 * This function automatically updates Pyth oracle prices to ensure fresh data.
 */
export async function buildLiquidateTransaction({
  position,
  owner,
  network,
  suiClient,
  repayAmount,
}: LiquidateTransactionOptions) {
  const tx = new Transaction();
  tx.setSender(owner);

  const contracts = CONTRACTS[network];
  const packageId = contracts.MARGIN_PACKAGE_ID;

  // === STEP 1: Update Pyth oracle prices ===
  // This is required because Pyth prices can become stale
  if (network === 'mainnet') {
    const mainnetContracts = contracts as typeof CONTRACTS.mainnet;

    // Create Pyth client
    const pythClient = new SuiPythClient(
      suiClient as any,
      mainnetContracts.PYTH_STATE_ID,
      mainnetContracts.WORMHOLE_STATE_ID
    );

    // Fetch fresh price update data from Hermes
    const priceUpdateData = await fetchPythPriceUpdates();

    // Add price update to transaction
    // This updates the cached prices on-chain before we use them
    const priceIds = [PYTH_PRICE_FEEDS.SUI_USD, PYTH_PRICE_FEEDS.USDC_USD];
    await pythClient.updatePriceFeeds(tx as any, priceUpdateData, priceIds);
  }

  // Determine which asset is the debt (the one with outstanding debt)
  const hasBaseDebt = position.baseDebt > 0;
  const hasQuoteDebt = position.quoteDebt > 0;

  if (!hasBaseDebt && !hasQuoteDebt) {
    throw new Error("Position has no debt to liquidate");
  }

  // For SUI/USDC positions:
  // - BaseAsset = SUI
  // - QuoteAsset = USDC
  // We need to determine which one has debt and repay that
  const baseAssetType = network === 'mainnet'
    ? contracts.SUI_MARGIN_POOL_TYPE
    : contracts.SUI_MARGIN_POOL_TYPE;

  const quoteAssetType = network === 'mainnet'
    ? (contracts as typeof CONTRACTS.mainnet).USDC_MARGIN_POOL_TYPE
    : (contracts as typeof CONTRACTS.testnet).DBUSDC_MARGIN_POOL_TYPE;

  // Determine debt asset and amounts
  // Priority: use quote debt first (USDC) as it's more common and stable
  let debtAssetType: string;
  let debtMarginPoolId: string | null;
  let debtDecimals: number;
  let debtAmount: number;

  if (hasQuoteDebt && position.quoteMarginPoolId) {
    debtAssetType = quoteAssetType;
    debtMarginPoolId = position.quoteMarginPoolId;
    debtDecimals = 6; // USDC decimals
    debtAmount = position.quoteDebt;
  } else if (hasBaseDebt && position.baseMarginPoolId) {
    debtAssetType = baseAssetType;
    debtMarginPoolId = position.baseMarginPoolId;
    debtDecimals = 9; // SUI decimals
    debtAmount = position.baseDebt;
  } else {
    throw new Error("Cannot determine debt asset or margin pool ID");
  }

  // Get the repay coin
  const coinType = debtAssetType;
  const coins = await suiClient.getCoins({
    owner,
    coinType,
    limit: 200,
  });

  if (!coins.data.length) {
    throw new Error(`No ${position.baseAssetSymbol}/${position.quoteAssetSymbol} balance available to repay debt`);
  }

  // Calculate repay amount (use provided amount or estimate from debt)
  // Add a buffer for interest accrual
  const debtWithBuffer = BigInt(Math.ceil(debtAmount * 1.01)); // 1% buffer
  const targetRepayAmount = repayAmount ?? debtWithBuffer;

  // Check if user has enough balance
  const totalBalance = coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
  if (totalBalance < targetRepayAmount) {
    throw new Error(
      `Insufficient balance to repay. Need ${Number(targetRepayAmount) / 10 ** debtDecimals} but have ${Number(totalBalance) / 10 ** debtDecimals}`
    );
  }

  // Merge coins if needed and split the repay amount
  let repayCoin;
  const isSui = normalizeStructTag(coinType) === normalizeStructTag("0x2::sui::SUI");

  if (isSui) {
    [repayCoin] = tx.splitCoins(tx.gas, [targetRepayAmount]);
  } else {
    // For non-SUI coins, merge all coins first then split
    if (coins.data.length > 1) {
      const [first, ...rest] = coins.data.map(c => tx.object(c.coinObjectId));
      tx.mergeCoins(first, rest);
      [repayCoin] = tx.splitCoins(first, [targetRepayAmount]);
    } else {
      [repayCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [targetRepayAmount]);
    }
  }

  // Get oracle IDs (these are the PriceInfoObject IDs - the prices are now updated above)
  const baseOracleId = network === 'mainnet'
    ? (contracts as typeof CONTRACTS.mainnet).SUI_ORACLE_ID
    : "";
  const quoteOracleId = network === 'mainnet'
    ? (contracts as typeof CONTRACTS.mainnet).USDC_ORACLE_ID
    : "";

  if (!baseOracleId || !quoteOracleId) {
    throw new Error("Oracle IDs not configured for this network");
  }

  // Get DeepBook pool ID
  const deepbookPoolId = position.deepbookPoolId;
  if (!deepbookPoolId) {
    throw new Error("DeepBook pool ID not found for position");
  }

  // Call liquidate function
  // Returns: (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DebtAsset>)
  const [baseCoinOut, quoteCoinOut, remainingRepayCoin] = liquidate({
    package: packageId,
    arguments: {
      self: tx.object(position.marginManagerId),
      registry: tx.object(contracts.MARGIN_REGISTRY_ID),
      baseOracle: tx.object(baseOracleId),
      quoteOracle: tx.object(quoteOracleId),
      marginPool: tx.object(debtMarginPoolId!),
      pool: tx.object(deepbookPoolId),
      repayCoin: repayCoin,
    },
    typeArguments: [baseAssetType, quoteAssetType, debtAssetType],
  })(tx);

  // Transfer all received coins to the liquidator
  tx.transferObjects([baseCoinOut, quoteCoinOut, remainingRepayCoin], owner);

  // Set gas budget (liquidations with Pyth updates can be complex)
  tx.setGasBudget(2_000_000_000n); // 2 SUI - increased for Pyth update overhead

  // Set gas payment
  const suiCoinsForGas = await suiClient.getCoins({
    owner,
    coinType: "0x2::sui::SUI",
    limit: 200,
  });

  if (suiCoinsForGas.data.length > 0) {
    const gasCoin = suiCoinsForGas.data[0];
    tx.setGasPayment([{
      objectId: gasCoin.coinObjectId,
      version: gasCoin.version,
      digest: gasCoin.digest,
    }]);
  }

  return tx;
}
