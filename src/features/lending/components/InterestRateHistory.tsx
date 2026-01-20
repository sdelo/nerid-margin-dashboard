import type { FC } from "react";
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useInterestRateHistory } from "../hooks/useEvents";
import { TimeRangeSelector } from "../../../components/TimeRangeSelector";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton";
import type { TimeRange } from "../api/types";
import { useChartFirstRender } from "../../../components/charts/StableChart";

type Props = { poolId?: string };

export const InterestRateHistory: FC<Props> = ({ poolId }) => {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const interestRateQuery = useInterestRateHistory(poolId, timeRange);

  const chartData = React.useMemo(() => {
    if (!interestRateQuery.transformed) return [];

    return interestRateQuery.transformed.map((point) => ({
      time: new Date(point.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      timestamp: point.timestamp,
      baseRate: point.base_rate,
      baseSlope: point.base_slope,
      optimalUtilization: point.optimal_utilization,
      excessSlope: point.excess_slope,
    }));
  }, [interestRateQuery.transformed]);

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(chartData.length > 0);

  if (interestRateQuery.isLoading && chartData.length === 0) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-indigo-300 drop-shadow">
              Interest Rate History
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent mb-6"></div>
        <LoadingSkeleton height="h-[300px]" />
      </div>
    );
  }

  if (interestRateQuery.error) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-indigo-300 drop-shadow">
              Interest Rate History
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent mb-6"></div>
        <div className="text-red-400">Error loading interest rate history. Please try again.</div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-indigo-300 drop-shadow">
              Interest Rate History
            </h2>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent mb-6"></div>
        <EmptyState
          title="No Rate Changes"
          message="No interest rate parameter changes found for the selected time range."
        />
      </div>
    );
  }

  return (
    <div className="relative card-surface border border-white/10 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide text-indigo-300 drop-shadow">
            Interest Rate History
          </h2>
          <div className="text-xs text-cyan-100/60 mt-1">
            Historical interest rate parameter changes
          </div>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent mb-6"></div>

      <div
        className="rounded-2xl p-5 bg-white/5 border"
        style={{
          borderColor:
            "color-mix(in oklab, var(--color-indigo-400) 30%, transparent)",
        }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradBaseRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.2} />
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
              label={{ value: "%", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.7)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.8)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                color: "white",
              }}
              formatter={(value: number) => `${value.toFixed(2)}%`}
            />
            <Line
              type="monotone"
              dataKey="baseRate"
              stroke="#6366f1"
              strokeWidth={2}
              name="Base Rate"
              dot={{ fill: "#6366f1", r: 4 }}
              activeDot={{ r: 6 }}
              {...animationProps}
            />
            <Line
              type="monotone"
              dataKey="baseSlope"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Base Slope"
              dot={{ fill: "#8b5cf6", r: 4 }}
              activeDot={{ r: 6 }}
              {...animationProps}
            />
            <Line
              type="monotone"
              dataKey="optimalUtilization"
              stroke="#a78bfa"
              strokeWidth={2}
              name="Optimal Utilization"
              dot={{ fill: "#a78bfa", r: 4 }}
              activeDot={{ r: 6 }}
              {...animationProps}
            />
            <Line
              type="monotone"
              dataKey="excessSlope"
              stroke="#c4b5fd"
              strokeWidth={2}
              name="Excess Slope"
              dot={{ fill: "#c4b5fd", r: 4 }}
              activeDot={{ r: 6 }}
              {...animationProps}
            />
            <Legend
              align="left"
              verticalAlign="top"
              iconType="line"
              wrapperStyle={{
                color: "rgba(255,255,255,0.85)",
                paddingBottom: 12,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {interestRateQuery.transformed && interestRateQuery.transformed.length > 0 && (
        <div className="mt-4 text-[11px] text-cyan-100/70 leading-relaxed">
          Current rates: Base Rate{" "}
          <span className="text-indigo-300">
            {interestRateQuery.transformed[interestRateQuery.transformed.length - 1]!.base_rate.toFixed(2)}%
          </span>
          , Base Slope{" "}
          <span className="text-indigo-300">
            {interestRateQuery.transformed[interestRateQuery.transformed.length - 1]!.base_slope.toFixed(2)}%
          </span>
          , Optimal Utilization{" "}
          <span className="text-indigo-300">
            {interestRateQuery.transformed[interestRateQuery.transformed.length - 1]!.optimal_utilization.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default InterestRateHistory;

