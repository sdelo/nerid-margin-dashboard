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
  Legend,
} from "recharts";
import { useLoanEvents } from "../hooks/useEvents";
import { TimeRangeSelector } from "../../../components/TimeRangeSelector";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton";
import type { TimeRange } from "../api/types";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

type Props = { poolId?: string };

export const BorrowingActivity: FC<Props> = ({ poolId }) => {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const loanEvents = useLoanEvents(poolId, undefined, timeRange);

  const chartData = React.useMemo(() => {
    if (!loanEvents.aggregated) return [];

    // Calculate net borrowing (borrows - repays) over time
    let runningNet = 0;
    const netData: Array<{ time: string; net: number; borrows: number; repays: number }> = [];

    // Group by time and calculate net
    const timeMap = new Map<string, { borrows: number; repays: number }>();

    loanEvents.borrowed.forEach((event) => {
      const timeKey = new Date(event.checkpoint_timestamp_ms).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const existing = timeMap.get(timeKey) || { borrows: 0, repays: 0 };
      const amount = Number(event.loan_amount) / 1e9; // Convert from smallest units
      timeMap.set(timeKey, { ...existing, borrows: existing.borrows + amount });
    });

    loanEvents.repaid.forEach((event) => {
      const timeKey = new Date(event.checkpoint_timestamp_ms).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const existing = timeMap.get(timeKey) || { borrows: 0, repays: 0 };
      const amount = Number(event.repay_amount) / 1e9;
      timeMap.set(timeKey, { ...existing, repays: existing.repays + amount });
    });

    // Convert to array and calculate running net
    Array.from(timeMap.entries())
      .sort((a, b) => {
        const dateA = new Date(a[0]).getTime();
        const dateB = new Date(b[0]).getTime();
        return dateA - dateB;
      })
      .forEach(([time, values]) => {
        runningNet += values.borrows - values.repays;
        netData.push({
          time,
          net: runningNet,
          borrows: values.borrows,
          repays: values.repays,
        });
      });

    return netData;
  }, [loanEvents.aggregated, loanEvents.borrowed, loanEvents.repaid]);

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(chartData.length > 0);
  const borrowsGradientId = useStableGradientId('gradBorrows');
  const netGradientId = useStableGradientId('gradNet');

  if (loanEvents.isLoading && chartData.length === 0) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-teal-300 drop-shadow">
              Borrowing Activity
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent mb-6"></div>
        <LoadingSkeleton height="h-[300px]" />
      </div>
    );
  }

  if (loanEvents.error) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-teal-300 drop-shadow">
              Borrowing Activity
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent mb-6"></div>
        <div className="text-red-400">Error loading borrowing activity. Please try again.</div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-teal-300 drop-shadow">
              Borrowing Activity
            </h2>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent mb-6"></div>
        <EmptyState
          title="No Borrowing Activity"
          message="No borrowing activity found for the selected time range."
        />
      </div>
    );
  }

  return (
    <div className="relative card-surface border border-white/10 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide text-teal-300 drop-shadow">
            Borrowing Activity
          </h2>
          <div className="text-xs text-cyan-100/60 mt-1">
            Net borrowing over time (borrows - repays)
          </div>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
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
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={netGradientId} x1="0" y1="0" x2="0" y2="1">
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
              formatter={(value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} SUI`}
            />
            <Area
              type="monotone"
              dataKey="net"
              stroke="#fbbf24"
              strokeWidth={2}
              fill={`url(#${netGradientId})`}
              name="Net Borrowing"
              dot={false}
              {...animationProps}
            />
            <Legend
              align="left"
              verticalAlign="top"
              iconType="plainline"
              wrapperStyle={{
                color: "rgba(255,255,255,0.85)",
                paddingBottom: 12,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-[11px] text-cyan-100/70 leading-relaxed">
        Shows net borrowing position over time. Positive values indicate net borrowing,
        negative values indicate net repayment.
      </div>
    </div>
  );
};

export default BorrowingActivity;

