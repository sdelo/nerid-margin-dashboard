import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLoanBorrowed,
  fetchLoanRepaid,
  type AssetSuppliedEventResponse,
  type AssetWithdrawnEventResponse,
  type LoanBorrowedEventResponse,
  type LoanRepaidEventResponse,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import {
  ErrorIcon,
} from "../../../components/ThemedIcons";
import type { PoolOverview } from "../types";
import { calculatePoolRates, nineDecimalToPercent } from "../../../utils/interestRates";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

interface APYHistoryProps {
  pool: PoolOverview;
}

interface DailyDataPoint {
  date: string;
  timestamp: number;
  supply: number;
  borrow: number;
  utilization: number;
  supplyAPY: number;
  borrowAPY: number;
}

export function APYHistory({ pool }: APYHistoryProps) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [dailyData, setDailyData] = React.useState<DailyDataPoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  
  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(dailyData.length > 0);
  const gradientId = useStableGradientId('apyGradient');

  const decimals = pool.contracts?.coinDecimals ?? 9;
  const poolId = pool.contracts?.marginPoolId;

  // Interest config from pool
  const ic = pool.protocolConfig?.interest_config;
  const mc = pool.protocolConfig?.margin_pool_config;

  // Get current live APY using the shared calculation function
  const liveRates = React.useMemo(() => calculatePoolRates(pool), [pool]);

  // Calculate APY from utilization using the interest rate model
  // This uses the same formula as calculatePoolRates for consistency
  const calculateAPY = React.useCallback(
    (utilizationPct: number) => {
      if (!ic || !mc) return { supplyAPY: 0, borrowAPY: 0 };

      const u = utilizationPct / 100; // Convert percentage to decimal (0-1)
      
      // Convert 9-decimal values to percentages for calculation
      const baseRatePct = nineDecimalToPercent(ic.base_rate);
      const baseSlopePct = nineDecimalToPercent(ic.base_slope);
      const optimalPct = nineDecimalToPercent(ic.optimal_utilization);
      const optimalU = optimalPct / 100;
      const excessSlopePct = nineDecimalToPercent(ic.excess_slope);
      const spreadPct = nineDecimalToPercent(mc.protocol_spread);

      // Borrow APY calculation (matches calculateBorrowApr)
      const borrowAPY =
        u <= optimalU
          ? baseRatePct + baseSlopePct * u
          : baseRatePct + baseSlopePct * optimalU + excessSlopePct * (u - optimalU);

      // Supply APY = borrow APY * utilization * (1 - spread) (matches calculateSupplyApr)
      const supplyAPY = borrowAPY * u * (1 - spreadPct / 100);

      return { supplyAPY, borrowAPY };
    },
    [ic, mc]
  );

  // Fetch and process historical data
  React.useEffect(() => {
    async function fetchData() {
      if (!poolId) return;

      try {
        setIsLoading(true);
        setError(null);
        // Don't clear dailyData - preserve previous data to prevent flicker

        const params = {
          ...timeRangeToParams(timeRange),
          margin_pool_id: poolId,
          limit: 10000,
        };

        const [supplied, withdrawn, borrowed, repaid] = await Promise.all([
          fetchAssetSupplied(params),
          fetchAssetWithdrawn(params),
          fetchLoanBorrowed(params),
          fetchLoanRepaid(params),
        ]);

        // Build a running tally of supply and borrow over time
        const events: Array<{
          timestamp: number;
          type: "supply" | "withdraw" | "borrow" | "repay";
          amount: number;
        }> = [];

        supplied.forEach((e) => {
          events.push({
            timestamp: e.checkpoint_timestamp_ms,
            type: "supply",
            amount: parseFloat(e.amount) / 10 ** decimals,
          });
        });

        withdrawn.forEach((e) => {
          events.push({
            timestamp: e.checkpoint_timestamp_ms,
            type: "withdraw",
            amount: parseFloat(e.amount) / 10 ** decimals,
          });
        });

        borrowed.forEach((e) => {
          events.push({
            timestamp: e.checkpoint_timestamp_ms,
            type: "borrow",
            amount: parseFloat(e.loan_amount) / 10 ** decimals,
          });
        });

        repaid.forEach((e) => {
          events.push({
            timestamp: e.checkpoint_timestamp_ms,
            type: "repay",
            amount: parseFloat(e.repay_amount) / 10 ** decimals,
          });
        });

        // Sort by timestamp
        events.sort((a, b) => a.timestamp - b.timestamp);

        // Group by day and calculate running totals
        const dayMap = new Map<string, DailyDataPoint>();
        let runningSupply = pool.state?.supply ?? 0;
        let runningBorrow = pool.state?.borrow ?? 0;

        // If we have historical events, start from zero and build up
        // Otherwise use current state
        if (events.length > 0) {
          // Work backwards from current state to estimate starting point
          // This is an approximation - for production, you'd want historical snapshots
          events.forEach((event) => {
            if (event.type === "supply") runningSupply -= event.amount;
            if (event.type === "withdraw") runningSupply += event.amount;
            if (event.type === "borrow") runningBorrow -= event.amount;
            if (event.type === "repay") runningBorrow += event.amount;
          });

          // Ensure non-negative
          runningSupply = Math.max(0, runningSupply);
          runningBorrow = Math.max(0, runningBorrow);

          // Now replay forward
          events.forEach((event) => {
            if (event.type === "supply") runningSupply += event.amount;
            if (event.type === "withdraw")
              runningSupply = Math.max(0, runningSupply - event.amount);
            if (event.type === "borrow") runningBorrow += event.amount;
            if (event.type === "repay")
              runningBorrow = Math.max(0, runningBorrow - event.amount);

            const date = new Date(event.timestamp).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

            const utilizationPct =
              runningSupply > 0 ? (runningBorrow / runningSupply) * 100 : 0;
            const { supplyAPY, borrowAPY } = calculateAPY(utilizationPct);

            dayMap.set(date, {
              date,
              timestamp: event.timestamp,
              supply: runningSupply,
              borrow: runningBorrow,
              utilization: utilizationPct,
              supplyAPY: supplyAPY, // Already in percentage
              borrowAPY: borrowAPY, // Already in percentage
            });
          });
        }

        // Always add current live state as the final point to ensure chart ends at current APY
        // Use the same calculatePoolRates function that the pool card uses for consistency
        const livePoolRates = calculatePoolRates(pool);
        
        // Use a unique key with timestamp to ensure it comes last
        const nowKey = `Now_${Date.now()}`;
        dayMap.set(nowKey, {
          date: "Now",
          timestamp: Date.now(),
          supply: pool.state?.supply ?? 0,
          borrow: pool.state?.borrow ?? 0,
          utilization: livePoolRates.utilizationPct,
          supplyAPY: livePoolRates.supplyApr, // Directly use the live calculated APR
          borrowAPY: livePoolRates.borrowApr,
        });

        setDailyData(
          Array.from(dayMap.values()).sort((a, b) => a.timestamp - b.timestamp)
        );
      } catch (err) {
        console.error("Error fetching APY history:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [timeRange, poolId, decimals, calculateAPY, serverUrl, pool.state]);

  // Calculate stats - use live APY for current, historical for avg/min/max
  const stats = React.useMemo(() => {
    // Use the live calculated APY for "Current APY" to match the pool card
    const currentAPY = liveRates.supplyApr;
    
    if (dailyData.length === 0)
      return { avgAPY: currentAPY, maxAPY: currentAPY, minAPY: currentAPY, currentAPY };

    const apys = dailyData.map((d) => d.supplyAPY);
    return {
      avgAPY: apys.reduce((a, b) => a + b, 0) / apys.length,
      maxAPY: Math.max(...apys, currentAPY), // Include current in peak calculation
      minAPY: Math.min(...apys, currentAPY), // Include current in low calculation
      currentAPY, // Always use live value
    };
  }, [dailyData, liveRates.supplyApr]);

  return (
    <div className="space-y-6">
      {/* Header - matches Activity tab style */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            APY History
          </h2>
          <p className="text-sm text-white/60">
            Historical supply APY based on pool utilization for {pool.asset}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Current APY</div>
          <div className="text-2xl font-bold text-emerald-400">
            {stats.currentAPY < 0.01
              ? stats.currentAPY.toFixed(4)
              : stats.currentAPY.toFixed(2)}
            %
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Avg APY</div>
          <div className="text-2xl font-bold text-cyan-300">
            {stats.avgAPY < 0.01 ? stats.avgAPY.toFixed(4) : stats.avgAPY.toFixed(2)}%
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Peak APY</div>
          <div className="text-2xl font-bold text-teal-300">
            {stats.maxAPY < 0.01 ? stats.maxAPY.toFixed(4) : stats.maxAPY.toFixed(2)}%
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">
            {stats.minAPY === 0 ? "APY Floor (since launch)" : "Low APY"}
          </div>
          <div className="text-2xl font-bold text-white/70">
            {stats.minAPY === 0 ? (
              <span className="text-sm font-normal text-white/30">Insufficient history</span>
            ) : (
              <>{stats.minAPY < 0.01 ? stats.minAPY.toFixed(4) : stats.minAPY.toFixed(2)}%</>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <div className="text-xs text-white/60 flex items-center gap-2 mb-4">
          Supply APY Over Time
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
        </div>

        {isLoading && dailyData.length === 0 ? (
          <div className="h-72 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
              <div className="text-white/60">Calculating historical APY...</div>
            </div>
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-2 flex justify-center">
                <ErrorIcon size={32} />
              </div>
              <div className="text-red-300 font-semibold mb-1">
                Error loading data
              </div>
              <div className="text-white/60 text-sm">{error.message}</div>
            </div>
          </div>
        ) : dailyData.length <= 1 ? (
          <div className="h-72 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">📊</div>
              <div className="text-white font-semibold text-lg mb-2">
                Limited Historical Data
              </div>
              <div className="text-white/60 text-sm">
                Not enough activity in this time range to show historical APY trends.
                Try selecting a longer time range or check back later as the pool matures.
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={dailyData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v.toFixed(2)}%`}
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
                labelStyle={{ color: "#fff", fontWeight: "bold" }}
                formatter={(value: number, name: string) => [
                  `${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}%`,
                  name === "supplyAPY"
                    ? "Supply APY"
                    : name === "utilization"
                      ? "Utilization"
                      : name,
                ]}
              />
              <ReferenceLine
                y={stats.avgAPY}
                stroke="#22d3ee"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <Area
                type="monotone"
                dataKey="supplyAPY"
                stroke="#10b981"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                name="supplyAPY"
                {...animationProps}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Insight Box */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Historical Performance</span>
            <p className="mt-1">
              Chart shows actual supplier earnings based on utilization. Higher utilization = higher APY but lower withdrawal liquidity.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">APY Volatility</span>
            <p className="mt-1">
              {stats.maxAPY - stats.minAPY > 5 ? (
                <>Range of {(stats.maxAPY - stats.minAPY).toFixed(1)}% indicates dynamic borrowing demand.</>
              ) : (
                <>Stable APY suggests consistent demand and predictable returns.</>
              )}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Timing</span>
            <p className="mt-1">
              Dashed line = average APY. Depositing above this line means better-than-average entry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}






