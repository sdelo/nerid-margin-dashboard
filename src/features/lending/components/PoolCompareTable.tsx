import type { FC } from "react";
import React, { useState, useMemo } from "react";
import { ChevronRightIcon, UserIcon } from "@heroicons/react/24/outline";
import type { PoolOverview, UserPosition } from "../types";
import { usePoolActivityMetrics } from "../hooks/usePoolActivityMetrics";
import { InfoTooltip } from "../../../components/InfoTooltip";

function formatNumber(n: number, decimals: number = 2) {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + "M";
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(1) + "k";
  }
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return "—";
  
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 30) return `${diffDays}d`;
  return `${Math.floor(diffDays / 30)}mo`;
}

function formatFlowNumber(n: number): { text: string; isPositive: boolean; isZero: boolean } {
  const absValue = Math.abs(n);
  let text: string;
  
  if (absValue >= 1_000_000) {
    text = (absValue / 1_000_000).toFixed(1) + "M";
  } else if (absValue >= 1_000) {
    text = (absValue / 1_000).toFixed(1) + "k";
  } else if (absValue < 0.01) {
    return { text: "—", isPositive: false, isZero: true };
  } else {
    text = absValue.toFixed(0);
  }
  
  return {
    text: n > 0 ? `+${text}` : n < 0 ? `-${text}` : text,
    isPositive: n > 0,
    isZero: n === 0,
  };
}

type FilterMode = "all" | "my";

type Props = {
  pools: PoolOverview[];
  selectedPoolId: string | null;
  onSelectPool: (poolId: string) => void;
  userPositions?: UserPosition[];
};

export const PoolCompareTable: FC<Props> = ({
  pools,
  selectedPoolId,
  onSelectPool,
  userPositions = [],
}) => {
  const { metrics, isLoading: metricsLoading } = usePoolActivityMetrics(pools);

  // Build a map of asset -> user position balance
  const userPositionsByAsset = useMemo(() => {
    const map = new Map<string, { balance: number; formatted: string }>();
    for (const pos of userPositions) {
      const match = pos.balanceFormatted.match(/^([\d.,]+)/);
      const balance = match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
      if (balance > 0) {
        map.set(pos.asset, { balance, formatted: pos.balanceFormatted });
      }
    }
    return map;
  }, [userPositions]);

  // Determine if user has any positions
  const hasPositions = userPositionsByAsset.size > 0;

  // Default to "my" if user has positions, otherwise "all"
  const [filterMode, setFilterMode] = useState<FilterMode>(hasPositions ? "my" : "all");

  // Update filter when positions change (e.g., first load)
  React.useEffect(() => {
    if (hasPositions && filterMode === "all") {
      // Only auto-switch if they just got positions
      // Keep their choice if they manually switched
    }
  }, [hasPositions, filterMode]);

  // Filter pools based on mode
  const filteredPools = useMemo(() => {
    if (filterMode === "my") {
      return pools.filter((pool) => userPositionsByAsset.has(pool.asset));
    }
    return pools;
  }, [pools, filterMode, userPositionsByAsset]);

  // Sort pools: pools with user positions first
  const sortedPools = useMemo(() => {
    return [...filteredPools].sort((a, b) => {
      const aHasPosition = userPositionsByAsset.has(a.asset);
      const bHasPosition = userPositionsByAsset.has(b.asset);
      if (aHasPosition && !bHasPosition) return -1;
      if (!aHasPosition && bHasPosition) return 1;
      return 0;
    });
  }, [filteredPools, userPositionsByAsset]);

  if (pools.length === 0) {
    return (
      <div className="p-4 text-center text-white/40 text-sm">
        No pools available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg">
      {/* Filter Toggle */}
      {hasPositions && (
        <div className="flex items-center gap-1 mb-3">
          <button
            onClick={() => setFilterMode("my")}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-all ${
              filterMode === "my"
                ? "bg-[#2dd4bf]/15 text-[#2dd4bf] ring-1 ring-inset ring-[#2dd4bf]/30"
                : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
            }`}
          >
            My markets
          </button>
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-all ${
              filterMode === "all"
                ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/[0.12]"
                : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
            }`}
          >
            All markets
          </button>
        </div>
      )}

      {/* Empty state for "My markets" when filtered */}
      {filterMode === "my" && sortedPools.length === 0 && (
        <div className="p-6 text-center">
          <p className="text-sm text-white/50 mb-2">No positions yet</p>
          <button
            onClick={() => setFilterMode("all")}
            className="text-xs text-[#2dd4bf] hover:text-[#5eead4] transition-colors"
          >
            View all markets →
          </button>
        </div>
      )}

      {sortedPools.length > 0 && (
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="text-[10px] text-white/40 uppercase tracking-wider">
              <th className="text-left font-medium pb-2.5 pl-3">Asset</th>
              <th className="text-right font-medium pb-2.5">
                <span className="inline-flex items-center whitespace-nowrap gap-1">
                  <UserIcon className="w-3 h-3" />
                  You
                </span>
              </th>
              <th className="text-right font-medium pb-2.5">Supplied</th>
              <th className="text-right font-medium pb-2.5">Borrowed</th>
              <th className="text-right font-medium pb-2.5">APY</th>
              <th className="text-right font-medium pb-2.5">Util</th>
              <th className="text-right font-medium pb-2.5">
                <span className="inline-flex items-center whitespace-nowrap">
                  Flow 7d
                  <InfoTooltip tooltip="netFlow7d" size="sm" />
                </span>
              </th>
              <th className="text-right font-medium pb-2.5">
                <span className="inline-flex items-center whitespace-nowrap">
                  Vol 7d
                  <InfoTooltip tooltip="borrowVolume7d" size="sm" />
                </span>
              </th>
              <th className="text-right font-medium pb-2.5">
                <span className="inline-flex items-center whitespace-nowrap">
                  Users 7d
                  <InfoTooltip tooltip="activeUsers7d" size="sm" />
                </span>
              </th>
              <th className="text-right font-medium pb-2.5">
                <span className="inline-flex items-center">
                  Last
                  <InfoTooltip tooltip="lastActivity" size="sm" />
                </span>
              </th>
              <th className="w-6 pb-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sortedPools.map((pool, index) => {
              const isSelected = pool.id === selectedPoolId;
              const utilizationPct =
                pool.state.supply > 0
                  ? (pool.state.borrow / pool.state.supply) * 100
                  : 0;
              const isEven = index % 2 === 0;
              
              // User position for this pool
              const userPosition = userPositionsByAsset.get(pool.asset);
              const hasUserPosition = !!userPosition;
              
              // Get activity metrics for this pool
              const poolId = pool.contracts?.marginPoolId;
              const poolMetrics = poolId ? metrics.get(poolId) : null;
              
              // Calculate last activity from all event types
              const lastActivityTime = poolMetrics ? Math.max(
                poolMetrics.lastBorrowTime ?? 0,
                poolMetrics.lastRepayTime ?? 0,
                poolMetrics.lastSupplyTime ?? 0,
                poolMetrics.lastWithdrawTime ?? 0,
              ) : null;
              
              // Format net flow
              const flowFormatted = poolMetrics 
                ? formatFlowNumber(poolMetrics.netFlow7d)
                : { text: "—", isPositive: false, isZero: true };

              return (
                <tr
                  key={pool.id}
                  onClick={() => onSelectPool(pool.id)}
                  className={`
                    cursor-pointer transition-all duration-150 group
                    ${isSelected 
                      ? "bg-[#2dd4bf]/15 ring-1 ring-inset ring-[#2dd4bf]/30" 
                      : hasUserPosition
                        ? "bg-[#2dd4bf]/[0.04] hover:bg-[#2dd4bf]/[0.08]"
                        : isEven 
                          ? "bg-white/[0.02] hover:bg-white/[0.06]" 
                          : "bg-transparent hover:bg-white/[0.06]"
                    }
                  `}
                >
                  {/* Asset */}
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <img
                          src={
                            pool.ui.iconUrl ||
                            `https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png`
                          }
                          alt={pool.asset}
                          className={`w-5 h-5 rounded-full transition-transform ${isSelected ? "scale-110" : "group-hover:scale-105"}`}
                        />
                        {/* "You" indicator dot */}
                        {hasUserPosition && (
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#2dd4bf] border border-[#0d1a1f]" />
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium transition-colors ${
                          isSelected ? "text-white" : "text-white/70 group-hover:text-white"
                        }`}
                      >
                        {pool.asset}
                      </span>
                    </div>
                  </td>

                  {/* Your Supplied */}
                  <td className="py-2.5 text-right">
                    {hasUserPosition ? (
                      <span className="text-xs font-mono text-[#2dd4bf]">
                        {formatNumber(userPosition.balance, 2)}
                      </span>
                    ) : (
                      <span className="text-xs text-white/20">—</span>
                    )}
                  </td>

                  {/* Supplied (TVL) */}
                  <td className="py-2.5 text-right">
                    <span className={`text-xs font-mono ${isSelected ? "text-white" : "text-white/50"}`}>
                      {formatNumber(pool.state.supply, 0)}
                    </span>
                  </td>

                  {/* Borrowed (Open Interest) */}
                  <td className="py-2.5 text-right">
                    <span className={`text-xs font-mono ${
                      pool.state.borrow > 0 
                        ? isSelected ? "text-amber-300" : "text-amber-400/70"
                        : "text-white/30"
                    }`}>
                      {pool.state.borrow > 0 ? formatNumber(pool.state.borrow, 0) : "—"}
                    </span>
                  </td>

                  {/* APY */}
                  <td className="py-2.5 text-right">
                    <span
                      className={`text-xs font-mono ${
                        isSelected ? "text-[#2dd4bf] font-semibold" : "text-emerald-400/80"
                      }`}
                    >
                      {pool.ui.aprSupplyPct.toFixed(2)}%
                    </span>
                  </td>

                  {/* Utilization */}
                  <td className="py-2.5 text-right">
                    <span
                      className={`text-xs font-mono ${
                        utilizationPct > 80
                          ? "text-red-400"
                          : utilizationPct > 50
                          ? "text-amber-400"
                          : "text-white/50"
                      }`}
                    >
                      {utilizationPct.toFixed(0)}%
                    </span>
                  </td>

                  {/* Net Flow 7d */}
                  <td className="py-2.5 text-right">
                    {metricsLoading ? (
                      <span className="text-xs text-white/30 animate-pulse">···</span>
                    ) : (
                      <span className={`text-xs font-mono ${
                        flowFormatted.isZero 
                          ? "text-white/30"
                          : flowFormatted.isPositive 
                            ? "text-emerald-400" 
                            : "text-red-400"
                      }`}>
                        {flowFormatted.text}
                      </span>
                    )}
                  </td>

                  {/* Borrow Volume 7d */}
                  <td className="py-2.5 text-right">
                    {metricsLoading ? (
                      <span className="text-xs text-white/30 animate-pulse">···</span>
                    ) : (
                      <span className={`text-xs font-mono ${
                        poolMetrics?.borrowVolume7d && poolMetrics.borrowVolume7d > 0
                          ? isSelected ? "text-white" : "text-white/50"
                          : "text-white/30"
                      }`}>
                        {poolMetrics?.borrowVolume7d && poolMetrics.borrowVolume7d > 0 
                          ? formatNumber(poolMetrics.borrowVolume7d, 0)
                          : "—"
                        }
                      </span>
                    )}
                  </td>

                  {/* Active Users 7d */}
                  <td className="py-2.5 text-right">
                    {metricsLoading ? (
                      <span className="text-xs text-white/30 animate-pulse">···</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <span className={`text-xs font-mono ${
                          (poolMetrics?.activeSuppliers7d ?? 0) > 0
                            ? isSelected ? "text-white" : "text-white/50"
                            : "text-white/30"
                        }`}>
                          {poolMetrics?.activeSuppliers7d ?? 0}
                        </span>
                        <span className="text-[10px] text-white/30">/</span>
                        <span className={`text-xs font-mono ${
                          (poolMetrics?.activeBorrowers7d ?? 0) > 0
                            ? isSelected ? "text-amber-300" : "text-amber-400/60"
                            : "text-white/30"
                        }`}>
                          {poolMetrics?.activeBorrowers7d ?? 0}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Last Activity */}
                  <td className="py-2.5 text-right">
                    {metricsLoading ? (
                      <span className="text-xs text-white/30 animate-pulse">···</span>
                    ) : (
                      <span className={`text-xs font-mono ${
                        lastActivityTime && lastActivityTime > Date.now() - 24 * 60 * 60 * 1000
                          ? "text-emerald-400"
                          : lastActivityTime && lastActivityTime > Date.now() - 7 * 24 * 60 * 60 * 1000
                          ? isSelected ? "text-white" : "text-white/50"
                          : "text-white/30"
                      }`}>
                        {formatTimeAgo(lastActivityTime || null)}
                      </span>
                    )}
                  </td>

                  {/* Chevron */}
                  <td className="py-2.5 pr-2 text-right">
                    <ChevronRightIcon 
                      className={`w-4 h-4 transition-all ${
                        isSelected 
                          ? "text-[#2dd4bf] translate-x-0" 
                          : "text-white/20 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                      }`} 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PoolCompareTable;
