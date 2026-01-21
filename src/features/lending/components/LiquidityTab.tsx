import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
} from "recharts";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLoanBorrowed,
  fetchLoanRepaid,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import type { PoolOverview } from "../types";
import { calculatePoolRates } from "../../../utils/interestRates";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

interface LiquidityTabProps {
  pool: PoolOverview;
}

interface DailyDataPoint {
  date: string;
  timestamp: number;
  availableLiquidity: number;
  utilization: number;
  supply: number;
  borrow: number;
}

export function LiquidityTab({ pool }: LiquidityTabProps) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [dailyData, setDailyData] = React.useState<DailyDataPoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  
  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(dailyData.length > 0);
  const gradientId = useStableGradientId('liquidityGradient');

  const decimals = pool.contracts?.coinDecimals ?? 9;
  const poolId = pool.contracts?.marginPoolId;

  // Get current live rates
  const liveRates = React.useMemo(() => calculatePoolRates(pool), [pool]);
  const currentAvailable = pool.state.supply - pool.state.borrow;
  const currentUtilization = liveRates.utilizationPct;

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

        // Build events list
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

        // Sort by timestamp (newest first for backward calculation)
        events.sort((a, b) => b.timestamp - a.timestamp);

        // Create a date range for all days in the selected period
        const now = new Date();
        const getDaysForRange = (range: TimeRange): number => {
          switch (range) {
            case "1W": return 7;
            case "1M": return 30;
            case "3M": return 90;
            case "YTD": {
              const startOfYear = new Date(now.getFullYear(), 0, 1);
              return Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
            }
            case "ALL": return 365; // Default to 1 year for ALL
            default: return 30;
          }
        };
        const daysToShow = getDaysForRange(timeRange);
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - daysToShow);
        startDate.setHours(0, 0, 0, 0);

        // Work BACKWARDS from current state to calculate historical states
        // Start with current known state
        let runningSupply = pool.state?.supply ?? 0;
        let runningBorrow = pool.state?.borrow ?? 0;

        // Create daily snapshots map - keyed by date string
        const dailySnapshots = new Map<string, { supply: number; borrow: number; timestamp: number }>();

        // Add current state for today
        const todayKey = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dailySnapshots.set(todayKey, {
          supply: runningSupply,
          borrow: runningBorrow,
          timestamp: now.getTime(),
        });

        // Process events from newest to oldest (working backwards)
        events.forEach((event) => {
          const eventDate = new Date(event.timestamp);
          
          // Reverse the effect of the event to get the state BEFORE the event
          if (event.type === "supply") {
            runningSupply -= event.amount;
          } else if (event.type === "withdraw") {
            runningSupply += event.amount;
          } else if (event.type === "borrow") {
            runningBorrow -= event.amount;
          } else if (event.type === "repay") {
            runningBorrow += event.amount;
          }

          // Clamp to prevent negative values from floating point errors
          runningSupply = Math.max(0, runningSupply);
          runningBorrow = Math.max(0, runningBorrow);

          const dateKey = eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          
          // Store the state at the START of this day (before all events on this day)
          // Only update if this is an earlier state for this day
          if (!dailySnapshots.has(dateKey) || event.timestamp < dailySnapshots.get(dateKey)!.timestamp) {
            dailySnapshots.set(dateKey, {
              supply: runningSupply,
              borrow: runningBorrow,
              timestamp: event.timestamp,
            });
          }
        });

        // Fill in all days in the range (for days with no events, carry forward the previous day's state)
        const result: DailyDataPoint[] = [];
        let lastKnownState = { supply: runningSupply, borrow: runningBorrow };

        for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
          const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const isToday = d.toDateString() === now.toDateString();
          
          // Get state for this day, or use last known state
          const snapshot = dailySnapshots.get(dateKey);
          if (snapshot) {
            lastKnownState = { supply: snapshot.supply, borrow: snapshot.borrow };
          }

          const supply = lastKnownState.supply;
          const borrow = lastKnownState.borrow;
          const available = Math.max(0, supply - borrow);
          const utilization = supply > 0 ? Math.min(Math.max((borrow / supply) * 100, 0), 100) : 0;

          result.push({
            date: isToday ? `${dateKey} (now)` : dateKey,
            timestamp: d.getTime(),
            availableLiquidity: available,
            utilization,
            supply,
            borrow,
          });
        }

        setDailyData(result);
      } catch (err) {
        console.error("Error fetching liquidity history:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch data"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [poolId, decimals, serverUrl, timeRange, pool.state]);

  // Format number for display
  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + "K";
    if (Math.abs(num) >= 1) return num.toFixed(0);
    return num.toFixed(2);
  };

  // Calculate stress scenarios
  const stressScenarios = React.useMemo(() => {
    const supply = pool.state.supply;
    const borrow = pool.state.borrow;

    // Scenario 1: If utilization rises to 80%
    const targetUtil80 = 0.8;
    const borrowAt80 = supply * targetUtil80;
    const availableAt80 = supply - borrowAt80;

    // Scenario 2: If borrow demand increases 20%
    const borrowIncrease20 = borrow * 1.2;
    const availableAfterIncrease = Math.max(0, supply - borrowIncrease20);
    const utilAfterIncrease = supply > 0 ? (borrowIncrease20 / supply) * 100 : 0;

    return {
      util80: {
        available: availableAt80,
        currentUtil: currentUtilization,
        isRelevant: currentUtilization < 80,
      },
      borrowPlus20: {
        available: availableAfterIncrease,
        newUtil: Math.min(utilAfterIncrease, 100),
        borrowIncrease: borrow * 0.2,
      },
    };
  }, [pool.state, currentUtilization]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload as DailyDataPoint;

    return (
      <div className="bg-slate-900/95 border border-cyan-500/30 rounded-lg p-3 shadow-xl backdrop-blur-sm">
        <div className="text-xs text-cyan-400 font-medium mb-2">{label}</div>
        <div className="space-y-1.5">
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-slate-400">Available:</span>
            <span className="font-semibold text-cyan-300">
              {formatNumber(data.availableLiquidity)} {pool.asset}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-slate-400">Utilization:</span>
            <span className="font-medium text-amber-400">
              {data.utilization.toFixed(1)}%
            </span>
          </div>
          <div className="pt-1.5 border-t border-slate-700/50 mt-1.5">
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-slate-500">Total Supply:</span>
              <span className="text-slate-300">{formatNumber(data.supply)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-slate-500">Total Borrowed:</span>
              <span className="text-slate-300">{formatNumber(data.borrow)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Time range toggle component for header - matches Historical Activity style
  const timeRangeControls = (
    <div className="flex items-center gap-3">
      <span className="text-xs text-cyan-100/80">Range</span>
      <div className="rounded-xl bg-white/10 border border-cyan-300/30 overflow-hidden">
        {(["1W", "1M", "3M", "YTD", "ALL"] as TimeRange[]).map((rk) => (
          <button
            key={rk}
            onClick={() => setTimeRange(rk)}
            className={`px-3 py-1 transition-all ${
              timeRange === rk
                ? "bg-gradient-to-r from-cyan-400/20 to-blue-600/20 text-white border-l border-cyan-300/30"
                : "text-cyan-100/80 hover:text-white"
            }`}
          >
            {rk}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header - matches Activity tab style */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Available Liquidity
          </h2>
          <p className="text-sm text-white/60">
            Track how much liquidity is available for withdrawals for {pool.asset}
          </p>
        </div>
        {timeRangeControls}
      </div>

      {/* Stats Cards - matches Activity tab style */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-teal-500/30">
          <div className="text-sm text-white/60 mb-1">Available Now</div>
          <div className="text-xl font-bold text-teal-400">
            {formatNumber(currentAvailable)}
          </div>
          <div className="text-xs text-white/40 mt-1">{pool.asset}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Current Utilization</div>
          <div className={`text-xl font-bold ${
            currentUtilization > 80 ? "text-red-400" :
            currentUtilization > 50 ? "text-amber-400" :
            "text-emerald-400"
          }`}>
            {currentUtilization.toFixed(1)}%
          </div>
          <div className="text-xs text-white/40 mt-1">
            {currentUtilization > 80 ? "High utilization" :
             currentUtilization > 50 ? "Moderate" : "Low utilization"}
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">% of Supply Available</div>
          <div className="text-xl font-bold text-white">
            {pool.state.supply > 0 ? ((currentAvailable / pool.state.supply) * 100).toFixed(0) : 0}%
          </div>
          <div className="text-xs text-white/40 mt-1">Ready for withdrawal</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        {isLoading && dailyData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              Loading liquidity history...
            </div>
          </div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center text-red-400">
              <p className="text-sm">Failed to load data</p>
              <p className="text-xs text-slate-500 mt-1">{error.message}</p>
            </div>
          </div>
        ) : dailyData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <p className="text-sm">No historical data available</p>
              <p className="text-xs text-slate-500 mt-1">Data will appear as pool activity occurs</p>
            </div>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="liquidity"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(value) => formatNumber(value)}
                  width={60}
                />
                <YAxis
                  yAxisId="utilization"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#fbbf24" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                  domain={[0, 100]}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  yAxisId="liquidity"
                  type="monotone"
                  dataKey="availableLiquidity"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  name="Available Liquidity"
                  {...animationProps}
                />
                <Line
                  yAxisId="utilization"
                  type="monotone"
                  dataKey="utilization"
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Utilization %"
                  {...animationProps}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-cyan-500" />
            <span className="text-slate-400">Available Liquidity ({pool.asset})</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-0 border-t-2 border-dashed border-amber-500/50" />
            <span className="text-slate-400">Utilization %</span>
          </div>
        </div>
      </div>

      {/* Stress / What-If Scenarios */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-cyan-200 mb-1">Stress Scenarios</h3>
          <p className="text-xs text-white/40">How much {pool.asset} would be available for withdrawal under different conditions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Scenario 1: Utilization to 80% */}
          <div className={`bg-white/5 rounded-2xl p-4 border ${
            stressScenarios.util80.isRelevant
              ? "border-amber-500/30"
              : "border-white/10 opacity-60"
          }`}>
            <div className="text-sm text-white/60 mb-1">If utilization rises to 80%</div>
            <div className="text-xl font-bold text-amber-400">
              ~{formatNumber(stressScenarios.util80.available)} <span className="text-sm font-normal text-white/50">{pool.asset} available</span>
            </div>
            <div className="text-xs text-white/40 mt-1">
              {stressScenarios.util80.isRelevant ? (
                <>Currently at {currentUtilization.toFixed(1)}% utilization</>
              ) : (
                <>Already above 80%</>
              )}
            </div>
          </div>

          {/* Scenario 2: Borrow demand +20% */}
          <div className="bg-white/5 rounded-2xl p-4 border border-red-500/30">
            <div className="text-sm text-white/60 mb-1">If borrow demand increases 20%</div>
            <div className="text-xl font-bold text-red-400">
              ~{formatNumber(stressScenarios.borrowPlus20.available)} <span className="text-sm font-normal text-white/50">{pool.asset} available</span>
            </div>
            <div className="text-xs text-white/40 mt-1">
              Utilization would be {stressScenarios.borrowPlus20.newUtil.toFixed(1)}%
              {stressScenarios.borrowPlus20.newUtil >= 100 && (
                <span className="text-red-400 ml-1">⚠ Fully utilized</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Liquidity Status */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-2">Is {formatNumber(currentAvailable)} {pool.asset} normal?</h3>
        <p className="text-sm text-white/60 leading-relaxed">
          {currentUtilization < 30 ? (
            <>
              This pool has <span className="text-emerald-400 font-medium">very high liquidity</span>. 
              Withdrawals should be instant with no issues. The low utilization ({currentUtilization.toFixed(0)}%) 
              means most supplied assets are sitting idle.
            </>
          ) : currentUtilization < 60 ? (
            <>
              This pool has <span className="text-cyan-400 font-medium">healthy liquidity</span>. 
              Most withdrawal sizes should be processed smoothly. The pool is being used efficiently 
              with a balanced utilization rate.
            </>
          ) : currentUtilization < 80 ? (
            <>
              This pool has <span className="text-amber-400 font-medium">moderate liquidity</span>. 
              Large withdrawals may need to wait for borrowers to repay. Consider the time it might 
              take for full liquidity to become available.
            </>
          ) : (
            <>
              This pool has <span className="text-red-400 font-medium">low available liquidity</span>. 
              Withdrawals may be delayed or partial. The high utilization indicates strong borrow 
              demand—you may need to wait for repayments.
            </>
          )}
        </p>
      </div>

      {/* What This Tells You */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Withdrawal Risk</span>
            <p className="mt-1">
              {currentUtilization > 70 ? (
                <>High utilization means most assets are lent out. Large withdrawals may require waiting for borrowers to repay.</>
              ) : (
                <>Low utilization means plenty of assets are available. Withdrawals should process instantly regardless of size.</>
              )}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Trend Analysis</span>
            <p className="mt-1">
              Watch for declining available liquidity over time—it signals growing borrow demand. Rising liquidity means borrowers are repaying or new suppliers are entering.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Stress Scenarios</span>
            <p className="mt-1">
              The scenarios above show how quickly liquidity could drop. If borrow demand spikes, the pool may temporarily have limited withdrawal capacity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
