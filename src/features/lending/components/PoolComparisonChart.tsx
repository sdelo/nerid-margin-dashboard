import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import type { PoolOverview } from "../types";
import { fetchMarketSummary } from "../api/marketData";
import { getAssetPriceUsd } from "../../../hooks/useAssetPrice";
import { useMultiPoolHistoricalState } from "../hooks/useMultiPoolHistoricalState";
import { useChartFirstRender } from "../../../components/charts/StableChart";
import type { TimeRange } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";

interface PoolComparisonChartProps {
  pools: PoolOverview[];
  currentPool: PoolOverview;
}

type CompareMetric = "tvl" | "utilization" | "supplyApy" | "borrowApy";

const METRIC_CONFIG: Record<
  CompareMetric,
  {
    label: string;
    shortLabel: string;
    unit: string;
    format: (v: number) => string;
    /** The suffix used in mergedData keys, e.g. "supply" for `SUI_supply` */
    dataKeySuffix: string;
  }
> = {
  tvl: {
    label: "TVL (USD)",
    shortLabel: "TVL",
    unit: "$",
    format: (v) =>
      v >= 1e6
        ? `$${(v / 1e6).toFixed(1)}M`
        : v >= 1e3
          ? `$${(v / 1e3).toFixed(0)}K`
          : `$${v.toFixed(0)}`,
    dataKeySuffix: "supply",
  },
  utilization: {
    label: "Utilization %",
    shortLabel: "Util",
    unit: "%",
    format: (v) => `${v.toFixed(1)}%`,
    dataKeySuffix: "utilization",
  },
  supplyApy: {
    label: "Supply APY %",
    shortLabel: "Supply APY",
    unit: "%",
    format: (v) => `${v.toFixed(2)}%`,
    dataKeySuffix: "supply", // We'll compute APY from supply/borrow
  },
  borrowApy: {
    label: "Borrow APY %",
    shortLabel: "Borrow APY",
    unit: "%",
    format: (v) => `${v.toFixed(2)}%`,
    dataKeySuffix: "borrow",
  },
};

const POOL_COLORS = [
  "#22d3ee",
  "#f59e0b",
  "#a855f7",
  "#10b981",
  "#ef4444",
  "#6366f1",
  "#ec4899",
];

function getPoolColor(index: number): string {
  return POOL_COLORS[index % POOL_COLORS.length];
}

/**
 * Multi-pool comparison with a real overlay chart + summary cards.
 * Replaces the old table-only comparison.
 */
export function PoolComparisonChart({
  pools,
  currentPool,
}: PoolComparisonChartProps) {
  const [metric, setMetric] = React.useState<CompareMetric>("tvl");
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [selectedPools, setSelectedPools] = React.useState<Set<string>>(() => {
    // Default: select all pools
    return new Set(pools.map((p) => p.id));
  });

  const metricCfg = METRIC_CONFIG[metric];

  // Get USD prices
  const { data: marketSummaries } = useQuery({
    queryKey: ["marketSummary"],
    queryFn: fetchMarketSummary,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const priceMap = React.useMemo(() => {
    const map = new Map<string, number>();
    if (!marketSummaries) return map;
    for (const p of pools) {
      map.set(p.asset, getAssetPriceUsd(p.asset, marketSummaries));
    }
    return map;
  }, [pools, marketSummaries]);

  // Fetch historical data for selected pools
  const { mergedData, seriesMap, isLoading } = useMultiPoolHistoricalState(
    pools,
    selectedPools,
    timeRange,
  );

  // Build current snapshot data for the cards
  const comparisonData = React.useMemo(() => {
    return pools
      .map((p) => {
        const price = priceMap.get(p.asset) || 0;
        const utilization =
          p.state.supply > 0
            ? (p.state.borrow / p.state.supply) * 100
            : 0;

        // Calculate APYs
        const interestConfig = p.protocolConfig?.interest_config;
        let borrowApr = 0;
        if (interestConfig) {
          const optimalUtil = interestConfig.optimal_utilization;
          const currentUtil = utilization / 100;
          if (currentUtil <= optimalUtil) {
            borrowApr =
              interestConfig.base_rate +
              interestConfig.base_slope * currentUtil;
          } else {
            borrowApr =
              interestConfig.base_rate +
              interestConfig.base_slope * optimalUtil +
              interestConfig.excess_slope * (currentUtil - optimalUtil);
          }
        }

        const protocolSpread =
          p.protocolConfig?.margin_pool_config?.protocol_spread ?? 0;
        const supplyApr =
          borrowApr * (utilization / 100) * (1 - protocolSpread);

        return {
          id: p.id,
          asset: p.asset,
          tvl: p.state.supply * price,
          tvlNative: p.state.supply,
          borrowed: p.state.borrow * price,
          borrowedNative: p.state.borrow,
          utilization,
          supplyApy: supplyApr * 100,
          borrowApy: borrowApr * 100,
          price,
          isCurrent: p.id === currentPool.id,
          iconUrl: p.ui.iconUrl,
          pool: p,
        };
      })
      .sort((a, b) => b.tvl - a.tvl);
  }, [pools, currentPool.id, priceMap]);

  // Build chart data with the selected metric
  const chartData = React.useMemo(() => {
    if (mergedData.length === 0) return [];

    const selectedPoolsList = pools.filter((p) => selectedPools.has(p.id));

    return mergedData.map((pt) => {
      const point: Record<string, unknown> = {
        date: pt.date,
        timestamp: pt.timestamp,
      };

      for (const p of selectedPoolsList) {
        const supply = (pt[`${p.asset}_supply`] as number) ?? 0;
        const borrow = (pt[`${p.asset}_borrow`] as number) ?? 0;
        const utilization = (pt[`${p.asset}_utilization`] as number) ?? 0;
        const price = priceMap.get(p.asset) || 0;

        if (metric === "tvl") {
          point[p.asset] = supply * price;
        } else if (metric === "utilization") {
          point[p.asset] = utilization;
        } else if (metric === "supplyApy" || metric === "borrowApy") {
          // Compute APY from historical utilization
          const ic = p.protocolConfig?.interest_config;
          const mc = p.protocolConfig?.margin_pool_config;
          if (ic) {
            const u = utilization / 100;
            const optU = ic.optimal_utilization;
            let bApr: number;
            if (u <= optU) {
              bApr = ic.base_rate + ic.base_slope * u;
            } else {
              bApr =
                ic.base_rate +
                ic.base_slope * optU +
                ic.excess_slope * (u - optU);
            }
            if (metric === "borrowApy") {
              point[p.asset] = bApr * 100;
            } else {
              const spread = mc?.protocol_spread ?? 0;
              point[p.asset] = bApr * u * (1 - spread) * 100;
            }
          } else {
            point[p.asset] = 0;
          }
        }
      }

      return point;
    });
  }, [mergedData, metric, pools, selectedPools, priceMap]);

  const { animationProps } = useChartFirstRender(chartData.length > 0);

  const togglePool = (poolId: string) => {
    setSelectedPools((prev) => {
      const next = new Set(prev);
      if (next.has(poolId)) {
        if (next.size > 1) next.delete(poolId);
      } else {
        next.add(poolId);
      }
      return next;
    });
  };

  // Get the sorted list of selected assets for consistent line rendering
  const selectedAssets = React.useMemo(() => {
    return comparisonData
      .filter((p) => selectedPools.has(p.id))
      .map((p) => p.asset);
  }, [comparisonData, selectedPools]);

  // Build color map: asset → color (stable across toggles)
  const colorMap = React.useMemo(() => {
    const map = new Map<string, string>();
    comparisonData.forEach((p, idx) => {
      map.set(p.asset, getPoolColor(idx));
    });
    return map;
  }, [comparisonData]);

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-[#0d1a1f] border border-white/10 rounded-xl px-4 py-3 shadow-xl">
        <p className="text-xs text-white/50 mb-2">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 py-0.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-white/70">{entry.name}</span>
            <span className="text-xs font-mono text-white ml-auto pl-4">
              {metricCfg.format(entry.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Y-axis formatter
  const yTickFormatter = (value: number) => {
    if (metric === "tvl") {
      if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
      return `$${value.toFixed(0)}`;
    }
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white mb-0.5">
            Pool Comparison
          </h2>
          <p className="text-xs text-white/50">
            Compare metrics across lending pools over time
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Metric selector */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {(Object.keys(METRIC_CONFIG) as CompareMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  metric === m
                    ? "bg-cyan-500 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                {METRIC_CONFIG[m].shortLabel}
              </button>
            ))}
          </div>
          {/* Time range selector */}
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            options={["1W", "1M", "3M"]}
          />
        </div>
      </div>

      {/* Pool toggle chips */}
      <div className="flex flex-wrap items-center gap-2">
        {comparisonData.map((p) => {
          const isSelected = selectedPools.has(p.id);
          const color = colorMap.get(p.asset)!;
          return (
            <button
              key={p.id}
              onClick={() => togglePool(p.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isSelected
                  ? "bg-white/[0.06] border-white/20 text-white"
                  : "bg-transparent border-white/[0.06] text-white/40 hover:text-white/60 hover:border-white/10"
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full transition-opacity"
                style={{
                  backgroundColor: color,
                  opacity: isSelected ? 1 : 0.3,
                }}
              />
              <span>{p.asset}</span>
              {p.isCurrent && (
                <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-cyan-500/20 text-cyan-400 rounded">
                  current
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
        {isLoading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-white/40">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Loading comparison data...
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-white/40">
            No historical data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={yTickFormatter}
                width={65}
              />
              <Tooltip content={<CustomTooltip />} />
              {selectedAssets.map((asset) => (
                <Line
                  key={asset}
                  type="monotone"
                  dataKey={asset}
                  name={asset}
                  stroke={colorMap.get(asset)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                  {...animationProps}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pool snapshot cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {comparisonData.map((p) => {
          const isSelected = selectedPools.has(p.id);
          const color = colorMap.get(p.asset)!;

          return (
            <button
              key={p.id}
              onClick={() => togglePool(p.id)}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? "bg-white/[0.04] border-white/10"
                  : "bg-transparent border-white/[0.04] opacity-50 hover:opacity-70"
              }`}
            >
              {/* Card header */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {p.iconUrl && (
                  <img
                    src={p.iconUrl}
                    alt={p.asset}
                    className="w-4 h-4 rounded-full"
                  />
                )}
                <span className="text-sm font-semibold text-white">
                  {p.asset}
                </span>
                {p.isCurrent && (
                  <span className="px-1.5 py-0.5 text-[7px] font-bold uppercase bg-cyan-500/20 text-cyan-400 rounded ml-auto">
                    current
                  </span>
                )}
              </div>

              {/* Metrics row */}
              <div className="flex items-center gap-4 text-[11px]">
                <div>
                  <span className="text-white/40 block">TVL</span>
                  <span className="font-mono text-white/80">
                    {p.tvl >= 1e6
                      ? `$${(p.tvl / 1e6).toFixed(1)}M`
                      : p.tvl >= 1e3
                        ? `$${(p.tvl / 1e3).toFixed(0)}K`
                        : `$${p.tvl.toFixed(0)}`}
                  </span>
                </div>
                <div className="w-px h-6 bg-white/[0.06]" />
                <div>
                  <span className="text-white/40 block">Util</span>
                  <span
                    className={`font-mono ${
                      p.utilization > 80
                        ? "text-red-400"
                        : p.utilization > 50
                          ? "text-amber-400"
                          : "text-white/70"
                    }`}
                  >
                    {p.utilization.toFixed(1)}%
                  </span>
                </div>
                <div className="w-px h-6 bg-white/[0.06]" />
                <div>
                  <span className="text-white/40 block">Supply</span>
                  <span className="font-mono text-cyan-400">
                    {p.supplyApy.toFixed(2)}%
                  </span>
                </div>
                <div className="w-px h-6 bg-white/[0.06]" />
                <div>
                  <span className="text-white/40 block">Borrow</span>
                  <span className="font-mono text-amber-400">
                    {p.borrowApy.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Utilization bar */}
              <div className="mt-2.5 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(p.utilization, 100)}%`,
                    backgroundColor: color,
                    opacity: isSelected ? 0.7 : 0.3,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Insights */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Best Yield</span>
            <p className="mt-1">
              {(() => {
                const best = [...comparisonData].sort(
                  (a, b) => b.supplyApy - a.supplyApy,
                )[0];
                return best
                  ? `${best.asset} offers the highest supply APY at ${best.supplyApy.toFixed(2)}%.`
                  : "No data.";
              })()}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">
              Cheapest Borrowing
            </span>
            <p className="mt-1">
              {(() => {
                const cheapest = [...comparisonData]
                  .filter((p) => p.borrowApy > 0)
                  .sort((a, b) => a.borrowApy - b.borrowApy)[0];
                return cheapest
                  ? `${cheapest.asset} has the lowest borrow rate at ${cheapest.borrowApy.toFixed(2)}%.`
                  : "No borrow data.";
              })()}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Most Liquid</span>
            <p className="mt-1">
              {(() => {
                const liquid = [...comparisonData].sort(
                  (a, b) =>
                    100 - a.utilization - (100 - b.utilization),
                )[0];
                return liquid
                  ? `${liquid.asset} has the most available liquidity (${(100 - liquid.utilization).toFixed(0)}% unused).`
                  : "No data.";
              })()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PoolComparisonChart;
