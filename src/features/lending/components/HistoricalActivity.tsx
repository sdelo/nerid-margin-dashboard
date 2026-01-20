import type { FC } from "react";
import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { useSupplyWithdrawEvents } from "../hooks/useEvents";
import { useInterestRateHistory } from "../hooks/useEvents";
import type { TimeRange } from "../api/types";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

type Props = { poolId: string };

export const HistoricalActivity: FC<Props> = ({ poolId }) => {
  type RangeKey = "1W" | "1M" | "3M" | "YTD" | "ALL";
  const [range, setRange] = React.useState<RangeKey>("1M");

  // Fetch real event data
  const supplyWithdrawEvents = useSupplyWithdrawEvents(poolId, undefined, range as TimeRange);
  const interestRateHistory = useInterestRateHistory(poolId, range as TimeRange);

  // Prepare chart data from real events
  const chartData = React.useMemo(() => {
    if (!supplyWithdrawEvents.aggregated) return [];

    return supplyWithdrawEvents.aggregated.map((point, idx) => ({
      time: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      timeIndex: idx,
      supply: point.supply,
      borrow: point.borrow,
    }));
  }, [supplyWithdrawEvents.aggregated]);

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(chartData.length > 0);
  const supplyGradientId = useStableGradientId('gradSupply');
  const borrowGradientId = useStableGradientId('gradBorrow');

  // Prepare rate change markers
  const rateChangeMarkers = React.useMemo(() => {
    if (!interestRateHistory.transformed || !supplyWithdrawEvents.aggregated) return [];

    return interestRateHistory.transformed.map((rateChange) => {
      // Find the closest data point index for this timestamp
      const closestIndex = supplyWithdrawEvents.aggregated!.findIndex(
        (point) => point.timestamp >= rateChange.timestamp
      );
      return closestIndex >= 0 ? closestIndex : null;
    }).filter((idx): idx is number => idx !== null);
  }, [interestRateHistory.transformed, supplyWithdrawEvents.aggregated]);

  // Loading state
  if (supplyWithdrawEvents.isLoading || interestRateHistory.isLoading) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-teal-300 drop-shadow">
              Historical Pool Activity
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent mb-6"></div>
        <div className="rounded-2xl p-5 bg-white/5 border flex items-center justify-center h-[300px]">
          <div className="text-cyan-100/80">Loading historical data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (supplyWithdrawEvents.error || interestRateHistory.error) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-teal-300 drop-shadow">
              Historical Pool Activity
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent mb-6"></div>
        <div className="rounded-2xl p-5 bg-white/5 border flex items-center justify-center h-[300px]">
          <div className="text-red-400">Error loading historical data. Please try again.</div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!chartData || chartData.length === 0) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-teal-300 drop-shadow">
              Historical Pool Activity
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent mb-6"></div>
        <div className="rounded-2xl p-5 bg-white/5 border flex items-center justify-center h-[300px]">
          <div className="text-cyan-100/80">No historical data available for the selected time range.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative card-surface border border-white/10 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide text-teal-300 drop-shadow">
            Historical Pool Activity
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-cyan-100/80">Range</span>
          <div className="rounded-xl bg-white/10 border border-cyan-300/30 overflow-hidden">
            {(["1W", "1M", "3M", "YTD", "ALL"] as RangeKey[]).map((rk) => (
              <button
                key={rk}
                onClick={() => setRange(rk)}
                className={`px-3 py-1 transition-all ${
                  range === rk
                    ? "bg-gradient-to-r from-cyan-400/20 to-blue-600/20 text-white border-l border-cyan-300/30"
                    : "text-cyan-100/80 hover:text-white"
                }`}
              >
                {rk}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent mb-6"></div>

      <div
        className="rounded-2xl p-5 bg-white/5 border"
        style={{
          borderColor:
            "color-mix(in oklab, var(--color-amber-400) 30%, transparent)",
        }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={supplyGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id={borrowGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.15)"
            />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.8)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                color: "white",
              }}
            />
            <Area
              type="monotone"
              dataKey="supply"
              stroke="var(--color-cyan-300)"
              strokeWidth={2}
              fill={`url(#${supplyGradientId})`}
              name="Supply"
              dot={false}
              {...animationProps}
            />
            <Area
              type="monotone"
              dataKey="borrow"
              stroke="var(--color-amber-400)"
              strokeWidth={2}
              fill={`url(#${borrowGradientId})`}
              name="Borrow"
              dot={false}
              {...animationProps}
            />

            {/* Rate change vertical markers */}
            {rateChangeMarkers.map((idx, i) => {
              const dataPoint = chartData[idx];
              if (!dataPoint) return null;
              return (
                <ReferenceLine
                  key={`rc-${i}`}
                  x={dataPoint.time}
                  stroke="var(--color-rose-400)"
                  strokeOpacity={0.9}
                  strokeWidth={2}
                />
              );
            })}

            <Legend
              align="left"
              verticalAlign="top"
              iconType="plainline"
              wrapperStyle={{
                color: "rgba(255,255,255,0.85)",
                paddingBottom: 12,
              }}
              payload={[
                { value: "Supply", type: "line", id: "s", color: "#22d3ee" },
                { value: "Borrow", type: "line", id: "b", color: "#fbbf24" },
                {
                  value: "Rate Change",
                  type: "square",
                  id: "r",
                  color: "#f472b6",
                },
              ]}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-[11px] text-cyan-100/70 leading-relaxed">
        Supply & Borrow series aggregate{" "}
        <span className="text-teal-300">AssetSupplied</span> and{" "}
        <span className="text-teal-300">AssetWithdrawn</span> over time.
        Vertical markers denote{" "}
        <span className="text-teal-300">InterestParamsUpdated</span> (rate
        config changes).
      </div>
    </div>
  );
};

export default HistoricalActivity;
