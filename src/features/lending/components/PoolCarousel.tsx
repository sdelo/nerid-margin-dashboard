import type { FC } from "react";
import React from "react";
import type { PoolOverview } from "../types";
import { InfoTooltip } from "../../../components/InfoTooltip";
import type { VaultBalanceMap } from "../../../hooks/useVaultBalances";

function formatNumber(n: number | bigint, decimals: number = 2) {
  const num = Number(n);
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + "K";
  }
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

type Props = {
  pools: PoolOverview[];
  selectedPoolId?: string | null;
  onSelectPool?: (poolId: string) => void;
  isLoading?: boolean;
  vaultBalances?: VaultBalanceMap;
};

export const PoolCarousel: FC<Props> = ({
  pools,
  selectedPoolId,
  isLoading = false,
  vaultBalances = {},
}) => {

  // Find current pool
  const currentIndex = React.useMemo(() => {
    return pools.findIndex((p) => p.id === selectedPoolId);
  }, [pools, selectedPoolId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-end">
        <div className="flex items-center gap-4 px-4 py-2 bg-white/[0.03] rounded-lg animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-16 bg-white/[0.05] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (pools.length === 0) {
    return null;
  }

  const currentPool = currentIndex >= 0 ? pools[currentIndex] : pools[0];
  const utilizationPct =
    currentPool.state.supply > 0
      ? (currentPool.state.borrow / currentPool.state.supply) * 100
      : 0;
  const vaultBalance =
    vaultBalances[currentPool.id] ??
    currentPool.state.supply - currentPool.state.borrow;

  // Status badge logic
  const getStatusBadge = () => {
    if (utilizationPct >= 80) {
      return { label: "HIGH UTIL", color: "bg-amber-500/12 text-amber-400" };
    }
    if (utilizationPct >= 50) {
      return { label: "OPTIMAL", color: "bg-[#2dd4bf]/12 text-[#2dd4bf]" };
    }
    return { label: "LOW UTIL", color: "bg-emerald-500/12 text-emerald-400" };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="flex-1 flex items-center justify-end">
      {/* Desktop: Premium Stats Strip */}
      <div className="hidden md:flex items-center gap-1 bg-white/[0.025] border border-white/[0.05] rounded-xl px-1 py-1">
        {/* APY - Primary metric with accent */}
        <div className="flex flex-col items-center px-4 py-2 bg-white/[0.03] rounded-lg">
          <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-wider">
            APY
            <InfoTooltip tooltip="supplyAPY" size="sm" />
          </div>
          <div className="text-lg font-semibold text-[#2dd4bf] font-mono">
            {Number(currentPool.ui.aprSupplyPct).toFixed(2)}%
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/[0.06]" />

        {/* Supplied */}
        <div className="flex flex-col items-center px-4 py-2">
          <div className="text-[10px] text-white/40 uppercase tracking-wider">
            Supplied
          </div>
          <div className="text-sm font-medium text-white font-mono">
            {formatNumber(currentPool.state.supply)}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/[0.06]" />

        {/* Borrowed */}
        <div className="flex flex-col items-center px-4 py-2">
          <div className="text-[10px] text-white/40 uppercase tracking-wider">
            Borrowed
          </div>
          <div className="text-sm font-medium text-amber-400 font-mono">
            {formatNumber(currentPool.state.borrow)}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/[0.06]" />

        {/* Available */}
        <div className="flex flex-col items-center px-4 py-2">
          <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-wider">
            Available
            <InfoTooltip tooltip="availableLiquidity" size="sm" />
          </div>
          <div className="text-sm font-medium text-emerald-400 font-mono">
            {formatNumber(vaultBalance)}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/[0.06]" />

        {/* Utilization */}
        <div className="flex flex-col items-center px-4 py-2">
          <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-wider">
            Util
            <InfoTooltip tooltip="utilizationRate" size="sm" />
          </div>
          <div className="text-sm font-medium text-white font-mono">
            {utilizationPct.toFixed(0)}%
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`ml-1 px-3 py-2 rounded-lg text-[10px] font-semibold tracking-wide ${statusBadge.color}`}
        >
          {statusBadge.label}
        </div>
      </div>

      {/* Mobile: Compact view */}
      <div className="flex md:hidden items-center gap-2">
        <div className="flex flex-col items-center px-3 py-2 bg-white/[0.04] rounded-lg border border-white/[0.06]">
          <div className="text-[9px] text-white/40 uppercase tracking-wider">
            APY
          </div>
          <div className="text-base font-semibold text-[#2dd4bf] font-mono">
            {Number(currentPool.ui.aprSupplyPct).toFixed(2)}%
          </div>
        </div>
        <div
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold ${statusBadge.color}`}
        >
          {statusBadge.label}
        </div>
      </div>
    </div>
  );
};

export default PoolCarousel;
