import { useState, useCallback } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildDepositTransaction,
  buildWithdrawTransaction,
  buildWithdrawAllTransaction,
} from "../lib/suiTransactions";
import { ONE_BILLION, GAS_AMOUNT_MIST, MIN_GAS_BALANCE_SUI } from "../constants";
import type { PoolOverview } from "../features/lending/types";
import type { UseTransactionToastReturn } from "./useTransactionToast";

type CoinBalanceInfo = {
  raw?: string;
  formatted?: string;
  refetch: () => void;
};

export type UseTransactionFlowOptions = {
  selectedPool: PoolOverview | null;
  coinBalance: CoinBalanceInfo;
  suiBalance: CoinBalanceInfo;
  refetchPools: () => void;
  toast: UseTransactionToastReturn;
};

export type UseTransactionFlowReturn = {
  txStatus: "idle" | "pending" | "success" | "error";
  txError: string | null;
  handleDeposit: (amount: number) => Promise<void>;
  handleWithdraw: (amount: number) => Promise<void>;
  handleWithdrawAll: () => Promise<void>;
  resetTxStatus: () => void;
};

/**
 * Encapsulates the full deposit / withdraw / withdraw-all transaction flow
 * including balance validation, transaction building, signing, waiting for
 * finalization, cache invalidation, and toast state transitions.
 */
export function useTransactionFlow({
  selectedPool,
  coinBalance,
  suiBalance,
  refetchPools,
  toast,
}: UseTransactionFlowOptions): UseTransactionFlowReturn {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const queryClient = useQueryClient();

  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txError, setTxError] = useState<string | null>(null);

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showRawEffects: true, showObjectChanges: true },
      }),
  });

  // ── helpers ──────────────────────────────────────────────────────────

  const validateGasBalance = useCallback((): boolean => {
    const suiBalanceNum = parseFloat(suiBalance?.raw || "0") / ONE_BILLION;
    if (suiBalanceNum < MIN_GAS_BALANCE_SUI) {
      setTxStatus("error");
      setTxError("Insufficient SUI for gas fees. You need at least 0.01 SUI.");
      return false;
    }
    return true;
  }, [suiBalance]);

  const invalidateCaches = useCallback(() => {
    Promise.all([refetchPools(), coinBalance.refetch(), suiBalance.refetch()]);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["assetSupplied"] });
      queryClient.invalidateQueries({ queryKey: ["assetWithdrawn"] });
    }, 3000);
  }, [refetchPools, coinBalance, suiBalance, queryClient]);

  const handleTxError = useCallback(
    (error: unknown) => {
      setTxStatus("error");
      const errorMsg = error instanceof Error ? error.message : "Transaction failed";
      setTxError(errorMsg);
      toast.setError();
    },
    [toast]
  );

  const waitAndFinalize = useCallback(
    async (digest: string) => {
      toast.setSubmitted(digest);

      const txResponse = await suiClient.waitForTransaction({
        digest,
        options: { showEffects: true, showEvents: true },
      });

      if (txResponse.effects?.status?.status !== "success") {
        setTxStatus("error");
        setTxError(txResponse.effects?.status?.error || "Transaction failed");
        toast.setError();
        return false;
      }

      toast.setFinalized();
      setTxStatus("success");
      invalidateCaches();
      return true;
    },
    [suiClient, toast, invalidateCaches]
  );

  // ── deposit ──────────────────────────────────────────────────────────

  const handleDeposit = useCallback(
    async (amount: number) => {
      if (!account || !selectedPool) return;
      if (!validateGasBalance()) return;

      // SUI-specific: validate total balance covers deposit + gas
      if (selectedPool.contracts.coinType === "0x2::sui::SUI") {
        try {
          const suiCoins = await suiClient.getCoins({
            owner: account.address,
            coinType: "0x2::sui::SUI",
          });
          const totalSuiBalance = suiCoins.data.reduce(
            (sum, coin) => sum + BigInt(coin.balance),
            0n
          );
          const gasAmount = BigInt(GAS_AMOUNT_MIST);
          const depositAmount = BigInt(Math.round(amount * ONE_BILLION));
          const totalNeeded = gasAmount + depositAmount;
          if (totalSuiBalance < totalNeeded) {
            setTxStatus("error");
            setTxError(
              `Insufficient SUI. Need ${Number(totalNeeded) / 1e9} SUI but have ${Number(totalSuiBalance) / 1e9} SUI.`
            );
            return;
          }
        } catch (error) {
          console.error("Error checking SUI coins:", error);
        }
      }

      // Validate asset balance
      const assetBalanceNum =
        parseFloat(coinBalance?.raw || "0") /
        Math.pow(10, selectedPool.contracts.coinDecimals);
      if (amount > assetBalanceNum) {
        setTxStatus("error");
        setTxError(`Insufficient ${selectedPool.asset} balance.`);
        return;
      }

      try {
        setTxStatus("pending");
        setTxError(null);
        toast.show("deposit", amount.toLocaleString(undefined, { maximumFractionDigits: 4 }));

        const poolContracts = selectedPool.contracts;
        const decimals = poolContracts.coinDecimals;
        const finalAmount = BigInt(Math.round(amount * 10 ** decimals));

        const tx = await buildDepositTransaction({
          amount: finalAmount,
          owner: account.address,
          coinType: poolContracts.coinType,
          poolId: poolContracts.marginPoolId,
          registryId: poolContracts.registryId,
          referralId: poolContracts.referralId,
          poolType: poolContracts.marginPoolType,
          suiClient,
        });

        const result = await signAndExecute({
          transaction: tx,
          chain: `sui:${network}`,
        });
        await waitAndFinalize(result.digest);
      } catch (error) {
        handleTxError(error);
      }
    },
    [
      account,
      selectedPool,
      signAndExecute,
      suiClient,
      network,
      coinBalance,
      toast,
      validateGasBalance,
      waitAndFinalize,
      handleTxError,
    ]
  );

  // ── withdraw ─────────────────────────────────────────────────────────

  const handleWithdraw = useCallback(
    async (amount: number) => {
      if (!account || !selectedPool) return;
      if (!validateGasBalance()) return;

      try {
        setTxStatus("pending");
        setTxError(null);
        toast.show("withdraw", amount.toLocaleString(undefined, { maximumFractionDigits: 4 }));

        const poolContracts = selectedPool.contracts;
        const decimals = poolContracts.coinDecimals;
        const finalAmount = BigInt(Math.round(amount * 10 ** decimals));

        const tx = await buildWithdrawTransaction({
          amount: finalAmount,
          poolId: poolContracts.marginPoolId,
          registryId: poolContracts.registryId,
          poolType: poolContracts.marginPoolType,
          owner: account.address,
          suiClient,
        });

        const result = await signAndExecute({
          transaction: tx,
          chain: `sui:${network}`,
        });
        await waitAndFinalize(result.digest);
      } catch (error) {
        handleTxError(error);
      }
    },
    [
      account,
      selectedPool,
      signAndExecute,
      network,
      suiClient,
      toast,
      validateGasBalance,
      waitAndFinalize,
      handleTxError,
    ]
  );

  // ── withdraw all ─────────────────────────────────────────────────────

  const handleWithdrawAll = useCallback(async () => {
    if (!account || !selectedPool) return;
    if (!validateGasBalance()) return;

    try {
      setTxStatus("pending");
      setTxError(null);
      toast.show("withdraw", "all");

      const poolContracts = selectedPool.contracts;

      const tx = await buildWithdrawAllTransaction({
        poolId: poolContracts.marginPoolId,
        registryId: poolContracts.registryId,
        poolType: poolContracts.marginPoolType,
        owner: account.address,
        suiClient,
      });

      const result = await signAndExecute({
        transaction: tx,
        chain: `sui:${network}`,
      });
      await waitAndFinalize(result.digest);
    } catch (error) {
      handleTxError(error);
    }
  }, [
    account,
    selectedPool,
    signAndExecute,
    network,
    suiClient,
    toast,
    validateGasBalance,
    waitAndFinalize,
    handleTxError,
  ]);

  // ── reset ────────────────────────────────────────────────────────────

  const resetTxStatus = useCallback(() => {
    setTxStatus("idle");
    setTxError(null);
  }, []);

  return {
    txStatus,
    txError,
    handleDeposit,
    handleWithdraw,
    handleWithdrawAll,
    resetTxStatus,
  };
}
