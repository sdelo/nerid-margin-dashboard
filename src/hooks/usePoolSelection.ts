import { useState, useMemo, useEffect, useCallback } from "react";
import type { PoolOverview, UserPosition } from "../features/lending/types";

export type PoolSwitchToast = {
  visible: boolean;
  asset: string | null;
  iconUrl?: string;
};

export type UsePoolSelectionReturn = {
  selectedPoolId: string | null;
  selectedPool: PoolOverview | null;
  selectedPoolDepositedBalance: number;
  pendingDepositAmount: string;
  setPendingDepositAmount: (amount: string) => void;
  handlePoolSelect: (poolId: string) => void;
  poolSwitchToast: PoolSwitchToast;
};

/**
 * Manages pool selection state including:
 * - Which pool is selected (with fallback to first pool)
 * - The user's deposited balance in the selected pool
 * - Pool switch toast animation
 * - Pending deposit amount (cleared on pool switch)
 *
 * Accepts an optional `initialPoolId` for URL-driven initial selection.
 */
export function usePoolSelection(
  pools: PoolOverview[],
  userPositions: UserPosition[],
  initialPoolId?: string | null
): UsePoolSelectionReturn {
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(
    initialPoolId ?? null
  );
  const [pendingDepositAmount, setPendingDepositAmount] = useState("");
  const [poolSwitchToast, setPoolSwitchToast] = useState<PoolSwitchToast>({
    visible: false,
    asset: null,
  });

  // Auto-select first pool when pools load and nothing is selected
  useEffect(() => {
    if (!selectedPoolId && pools.length > 0) {
      setSelectedPoolId(pools[0].id);
    }
  }, [pools, selectedPoolId]);

  // If initialPoolId changes (e.g. from URL navigation), update selection
  useEffect(() => {
    if (initialPoolId && pools.length > 0) {
      const exists = pools.some((p) => p.id === initialPoolId);
      if (exists) {
        setSelectedPoolId(initialPoolId);
      }
    }
  }, [initialPoolId, pools]);

  const selectedPool = useMemo(() => {
    if (pools.length === 0) return null;
    return pools.find((p) => p.id === selectedPoolId) ?? pools[0];
  }, [pools, selectedPoolId]);

  const selectedPoolDepositedBalance = useMemo(() => {
    if (!selectedPool || userPositions.length === 0) return 0;
    const position = userPositions.find((p) => p.asset === selectedPool.asset);
    if (!position) return 0;
    const match = position.balanceFormatted.match(/^([\d.,]+)/);
    if (match) {
      return parseFloat(match[1].replace(/,/g, "")) || 0;
    }
    return 0;
  }, [selectedPool, userPositions]);

  const handlePoolSelect = useCallback(
    (poolId: string) => {
      if (poolId !== selectedPoolId) {
        const newPool = pools.find((p) => p.id === poolId);
        setSelectedPoolId(poolId);
        setPendingDepositAmount("");

        // Show pool switch toast
        if (newPool) {
          setPoolSwitchToast({
            visible: true,
            asset: newPool.asset,
            iconUrl: newPool.ui.iconUrl || undefined,
          });
          // Auto-hide after animation completes
          setTimeout(() => {
            setPoolSwitchToast({ visible: false, asset: null });
          }, 2000);
        }
      }
    },
    [selectedPoolId, pools]
  );

  return {
    selectedPoolId,
    selectedPool,
    selectedPoolDepositedBalance,
    pendingDepositAmount,
    setPendingDepositAmount,
    handlePoolSelect,
    poolSwitchToast,
  };
}
