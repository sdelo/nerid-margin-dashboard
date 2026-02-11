import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  fetchLiquidations,
  type LiquidationEventResponse,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import {
  CheckIcon,
  ErrorIcon,
} from "../../../components/ThemedIcons";
import { useChartFirstRender } from "../../../components/charts/StableChart";

interface LiquidationWallProps {
  poolId?: string;
  asset?: string; // e.g., "SUI", "DBUSDC"
}

interface DailyLiquidationData {
  date: string;
  liquidationAmount: number;
  liquidationCount: number;
  badDebt: number;
  totalRewards: number;
  healthyAmount: number; // For stacked bar: amount without bad debt
}

export function LiquidationWall({ poolId, asset = "" }: LiquidationWallProps) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [liquidations, setLiquidations] = React.useState<
    LiquidationEventResponse[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Fetch liquidations - refetch when timeRange, poolId, or serverUrl changes
  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        // Clear old data immediately when server changes
        setLiquidations([]);

        const params = {
          ...timeRangeToParams(timeRange),
          ...(poolId && { margin_pool_id: poolId }),
          limit: 10000,
        };
        const data = await fetchLiquidations(params);
        setLiquidations(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching liquidations:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [timeRange, poolId, serverUrl]);

  // Aggregate by day
  const dailyData = React.useMemo(() => {
    const dataMap = new Map<string, DailyLiquidationData>();

    liquidations.forEach((liq) => {
      const date = new Date(liq.checkpoint_timestamp_ms).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
        }
      );

      const existing = dataMap.get(date) || {
        date,
        liquidationAmount: 0,
        liquidationCount: 0,
        badDebt: 0,
        totalRewards: 0,
        healthyAmount: 0,
      };

      const liqAmount = parseFloat(liq.liquidation_amount) / 1e9;
      const badDebtAmount = parseFloat(liq.pool_default) / 1e9;
      existing.liquidationAmount += liqAmount;
      existing.liquidationCount += 1;
      existing.badDebt += badDebtAmount;
      existing.totalRewards += parseFloat(liq.pool_reward) / 1e9;
      // Calculate healthy amount (total minus bad debt portion)
      existing.healthyAmount = existing.liquidationAmount - existing.badDebt;

      dataMap.set(date, existing);
    });

    return Array.from(dataMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [liquidations]);

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(dailyData.length > 0);

  // Calculate summary stats
  const stats = React.useMemo(() => {
    const totalLiquidations = liquidations.length;
    const totalVolume = liquidations.reduce(
      (sum, liq) => sum + parseFloat(liq.liquidation_amount) / 1e9,
      0
    );
    const totalBadDebt = liquidations.reduce(
      (sum, liq) => sum + parseFloat(liq.pool_default) / 1e9,
      0
    );
    const totalRewards = liquidations.reduce(
      (sum, liq) => sum + parseFloat(liq.pool_reward) / 1e9,
      0
    );
    const avgLiquidationSize =
      totalLiquidations > 0 ? totalVolume / totalLiquidations : 0;

    return {
      totalLiquidations,
      totalVolume,
      totalBadDebt,
      totalRewards,
      avgLiquidationSize,
    };
  }, [liquidations]);

  // Liquidation Efficiency metrics
  const efficiency = React.useMemo(() => {
    if (liquidations.length === 0) return null;

    // Coverage ratio: how much was covered vs total volume
    const coveredVolume = stats.totalVolume - stats.totalBadDebt;
    const coverageRatio = stats.totalVolume > 0
      ? (coveredVolume / stats.totalVolume) * 100
      : 100;

    // Reward efficiency: rewards earned relative to volume
    const rewardEfficiency = stats.totalVolume > 0
      ? (stats.totalRewards / stats.totalVolume) * 100
      : 0;

    // Bad debt rate per liquidation
    const badDebtRate = stats.totalLiquidations > 0
      ? stats.totalBadDebt / stats.totalLiquidations
      : 0;

    // Liquidations with any bad debt
    const liqsWithBadDebt = liquidations.filter(
      (liq) => parseFloat(liq.pool_default) > 0
    ).length;
    const cleanLiquidationRate = stats.totalLiquidations > 0
      ? ((stats.totalLiquidations - liqsWithBadDebt) / stats.totalLiquidations) * 100
      : 100;

    // Largest single liquidation
    const largestLiq = Math.max(
      ...liquidations.map((liq) => parseFloat(liq.liquidation_amount) / 1e9)
    );

    // Time clustering: check if liquidations cluster together
    const timestamps = liquidations.map((l) => l.checkpoint_timestamp_ms).sort((a, b) => a - b);
    let cascadeEvents = 0;
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] < 5 * 60 * 1000) { // within 5 minutes
        cascadeEvents++;
      }
    }
    const cascadeRate = timestamps.length > 1
      ? (cascadeEvents / (timestamps.length - 1)) * 100
      : 0;

    return {
      coverageRatio,
      rewardEfficiency,
      badDebtRate,
      cleanLiquidationRate,
      largestLiq,
      liqsWithBadDebt,
      cascadeRate,
    };
  }, [liquidations, stats]);

  return (
    <div className="space-y-6">
      {/* Header - matches Activity tab style */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Liquidation Wall
          </h2>
          <p className="text-sm text-white/60">
            Historical liquidation activity and system health{asset ? ` for ${asset}` : ""}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Stats Cards - matches Activity tab style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-teal-500/30">
          <div className="text-sm text-white/60 mb-1">Total Liquidations</div>
          <div className="text-xl font-bold text-teal-400">{stats.totalLiquidations}</div>
          <div className="text-xs text-white/40 mt-1">Events</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Total Volume</div>
          <div className="text-xl font-bold text-cyan-400">
            {stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-white/40 mt-1">{asset || "tokens"}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Avg. Size</div>
          <div className="text-xl font-bold text-white">
            {stats.avgLiquidationSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-white/40 mt-1">{asset || "tokens"} per event</div>
        </div>
        <div className={`bg-white/5 rounded-2xl p-4 border ${stats.totalBadDebt > 0 ? "border-red-500/30" : "border-emerald-500/30"}`}>
          <div className="text-sm text-white/60 mb-1">Bad Debt</div>
          <div className={`text-xl font-bold ${stats.totalBadDebt > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {stats.totalBadDebt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-white/40 mt-1">{stats.totalBadDebt > 0 ? "Needs attention" : "All covered"}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">Liquidations Over Time</h3>

        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
              <div className="text-white/50 text-xs">Loading...</div>
            </div>
          </div>
        ) : error ? (
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-2 flex justify-center"><ErrorIcon size={24} /></div>
              <div className="text-red-300 text-sm">{error.message}</div>
            </div>
          </div>
        ) : dailyData.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-2 flex justify-center"><CheckIcon size={32} /></div>
              <div className="text-white/80 text-sm font-medium">No Liquidations</div>
              <div className="text-white/50 text-xs mt-1">Healthy sign — protocol managing risk well</div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "#fff", fontWeight: "bold", marginBottom: "4px" }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                  name === "healthyAmount" ? "Healthy" : "Bad Debt"
                ]}
              />
              <Legend 
                wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                formatter={(value) => (
                  <span className="text-white/60">{value === "healthyAmount" ? "Healthy" : "Bad Debt"}</span>
                )}
              />
              <Bar dataKey="healthyAmount" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} {...animationProps} />
              <Bar dataKey="badDebt" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} {...animationProps} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Liquidation Efficiency */}
      {efficiency && (
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-cyan-200 mb-4">Liquidation Efficiency</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Coverage Ratio</div>
              <div className={`text-lg font-bold font-mono ${
                efficiency.coverageRatio >= 99 ? "text-emerald-400" :
                efficiency.coverageRatio >= 95 ? "text-amber-400" : "text-red-400"
              }`}>
                {efficiency.coverageRatio.toFixed(1)}%
              </div>
              <div className="text-[10px] text-white/30 mt-1">Volume covered w/o bad debt</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Clean Liquidations</div>
              <div className={`text-lg font-bold font-mono ${
                efficiency.cleanLiquidationRate >= 90 ? "text-emerald-400" :
                efficiency.cleanLiquidationRate >= 70 ? "text-amber-400" : "text-red-400"
              }`}>
                {efficiency.cleanLiquidationRate.toFixed(0)}%
              </div>
              <div className="text-[10px] text-white/30 mt-1">{stats.totalLiquidations - efficiency.liqsWithBadDebt}/{stats.totalLiquidations} zero bad debt</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Pool Rewards</div>
              <div className="text-lg font-bold font-mono text-teal-400">
                {stats.totalRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-white/30 mt-1">{asset} earned ({efficiency.rewardEfficiency.toFixed(1)}% of vol)</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Cascade Rate</div>
              <div className={`text-lg font-bold font-mono ${
                efficiency.cascadeRate > 30 ? "text-amber-400" : "text-white"
              }`}>
                {efficiency.cascadeRate.toFixed(0)}%
              </div>
              <div className="text-[10px] text-white/30 mt-1">Liqs within 5 min of each other</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50 bg-white/[0.02] p-3 rounded-lg">
            <span>📊</span>
            <span>
              {efficiency.coverageRatio >= 99
                ? "Excellent — liquidation system is operating efficiently with minimal bad debt."
                : efficiency.coverageRatio >= 95
                  ? "Good — most liquidations are covered but some positions are occasionally underwater."
                  : "Concerning — significant bad debt indicates positions aren't being liquidated early enough."
              }
              {efficiency.cascadeRate > 30 && " High cascade rate suggests correlated liquidation events."}
            </span>
          </div>
        </div>
      )}

      {/* Interpretation Guide */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">System Health</span>
            <p className="mt-1">
              {stats.totalBadDebt === 0 ? (
                <>All liquidations covered. Protocol managing risk effectively.</>
              ) : (
                <>Bad debt: {((stats.totalBadDebt / stats.totalVolume) * 100).toFixed(2)}% of volume. Some positions liquidated late.</>
              )}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Frequency</span>
            <p className="mt-1">
              {stats.totalLiquidations > 0 ? (
                <>{stats.totalLiquidations} liquidation{stats.totalLiquidations !== 1 ? "s" : ""} this period. High frequency may signal volatile markets.</>
              ) : (
                <>No liquidations — conservative risk management or stable conditions.</>
              )}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Risk Assessment</span>
            <p className="mt-1">
              Small, regular liquidations are healthy. Large spikes or increasing bad debt warrant caution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
