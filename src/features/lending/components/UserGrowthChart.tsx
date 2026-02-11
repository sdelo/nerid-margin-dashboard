import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLoanBorrowed,
  fetchLoanRepaid,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import { ErrorIcon } from "../../../components/ThemedIcons";
import type { PoolOverview } from "../types";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

interface UserGrowthChartProps {
  pool: PoolOverview;
}

interface DailyUserData {
  date: string;
  timestamp: number;
  uniqueAddresses: number;    // cumulative unique addresses seen up to this day
  newAddresses: number;       // first-time addresses on this day
  activeAddresses: number;    // addresses with any event on this day
  supplyAddresses: number;    // unique suppliers active today
  borrowAddresses: number;    // unique borrowers active today
}

export function UserGrowthChart({ pool }: UserGrowthChartProps) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>("ALL");
  const [dailyData, setDailyData] = React.useState<DailyUserData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const decimals = pool.contracts?.coinDecimals ?? 9;
  const poolId = pool.contracts?.marginPoolId;

  const { animationProps } = useChartFirstRender(dailyData.length > 0);
  const cumGradientId = useStableGradientId('userGrowthGradient');

  React.useEffect(() => {
    async function fetchData() {
      if (!poolId) return;

      try {
        setIsLoading(true);
        setError(null);

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

        // Build per-day sets of active + new addresses
        const allTimeSeen = new Set<string>();
        const dayMap = new Map<
          string,
          {
            timestamp: number;
            supplyAddrs: Set<string>;
            borrowAddrs: Set<string>;
            allAddrs: Set<string>;
            newAddrs: Set<string>;
          }
        >();

        const getOrCreateDay = (ts: number) => {
          const date = new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          if (!dayMap.has(date)) {
            dayMap.set(date, {
              timestamp: ts,
              supplyAddrs: new Set(),
              borrowAddrs: new Set(),
              allAddrs: new Set(),
              newAddrs: new Set(),
            });
          }
          const day = dayMap.get(date)!;
          day.timestamp = Math.max(day.timestamp, ts);
          return day;
        };

        // We need to process events in chronological order to track "new" users
        interface EventEntry { timestamp: number; address: string; type: "supply" | "borrow" }
        const allEvents: EventEntry[] = [];

        supplied.forEach((e) => allEvents.push({ timestamp: e.checkpoint_timestamp_ms, address: e.supplier, type: "supply" }));
        withdrawn.forEach((e) => allEvents.push({ timestamp: e.checkpoint_timestamp_ms, address: e.supplier, type: "supply" }));
        borrowed.forEach((e) => allEvents.push({ timestamp: e.checkpoint_timestamp_ms, address: e.margin_manager_id, type: "borrow" }));
        repaid.forEach((e) => allEvents.push({ timestamp: e.checkpoint_timestamp_ms, address: e.margin_manager_id, type: "borrow" }));

        allEvents.sort((a, b) => a.timestamp - b.timestamp);

        allEvents.forEach((evt) => {
          const day = getOrCreateDay(evt.timestamp);
          day.allAddrs.add(evt.address);
          if (evt.type === "supply") day.supplyAddrs.add(evt.address);
          if (evt.type === "borrow") day.borrowAddrs.add(evt.address);

          if (!allTimeSeen.has(evt.address)) {
            allTimeSeen.add(evt.address);
            day.newAddrs.add(evt.address);
          }
        });

        // Build sorted daily data
        const sortedDays = Array.from(dayMap.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        );

        let cumulativeUnique = 0;
        const result: DailyUserData[] = sortedDays.map(([date, day]) => {
          cumulativeUnique += day.newAddrs.size;
          return {
            date,
            timestamp: day.timestamp,
            uniqueAddresses: cumulativeUnique,
            newAddresses: day.newAddrs.size,
            activeAddresses: day.allAddrs.size,
            supplyAddresses: day.supplyAddrs.size,
            borrowAddresses: day.borrowAddrs.size,
          };
        });

        setDailyData(result);
      } catch (err) {
        console.error("Error fetching user growth:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [timeRange, poolId, decimals, serverUrl]);

  // Stats
  const stats = React.useMemo(() => {
    const totalUnique = dailyData.length > 0 ? dailyData[dailyData.length - 1].uniqueAddresses : 0;
    const totalNew = dailyData.reduce((sum, d) => sum + d.newAddresses, 0);
    const avgDailyActive = dailyData.length > 0
      ? dailyData.reduce((sum, d) => sum + d.activeAddresses, 0) / dailyData.length
      : 0;
    const peakActive = dailyData.length > 0
      ? Math.max(...dailyData.map((d) => d.activeAddresses))
      : 0;

    // Recent growth: compare last 7 days vs previous 7
    const last7 = dailyData.slice(-7);
    const prev7 = dailyData.slice(-14, -7);
    const recentNewUsers = last7.reduce((sum, d) => sum + d.newAddresses, 0);
    const prevNewUsers = prev7.reduce((sum, d) => sum + d.newAddresses, 0);
    const growthTrend = prevNewUsers > 0
      ? ((recentNewUsers - prevNewUsers) / prevNewUsers) * 100
      : 0;

    return { totalUnique, totalNew, avgDailyActive, peakActive, recentNewUsers, growthTrend };
  }, [dailyData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            User Growth
          </h2>
          <p className="text-sm text-white/60">
            Unique participants and adoption trends for {pool.asset}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-teal-500/30">
          <div className="text-sm text-white/60 mb-1">Total Users</div>
          <div className="text-xl font-bold text-teal-400">{stats.totalUnique}</div>
          <div className="text-xs text-white/40 mt-1">unique addresses</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Avg Daily Active</div>
          <div className="text-xl font-bold text-cyan-400">{stats.avgDailyActive.toFixed(1)}</div>
          <div className="text-xs text-white/40 mt-1">addresses/day</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Peak Active</div>
          <div className="text-xl font-bold text-white">{stats.peakActive}</div>
          <div className="text-xs text-white/40 mt-1">in a single day</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-emerald-500/20">
          <div className="text-sm text-white/60 mb-1">New (7d)</div>
          <div className="text-xl font-bold text-emerald-400">{stats.recentNewUsers}</div>
          <div className="text-xs text-white/40 mt-1">last 7 days</div>
        </div>
        <div className={`bg-white/5 rounded-2xl p-4 border ${
          stats.growthTrend > 0 ? "border-emerald-500/20" : stats.growthTrend < 0 ? "border-red-500/20" : "border-white/10"
        }`}>
          <div className="text-sm text-white/60 mb-1">Growth Trend</div>
          <div className={`text-xl font-bold ${
            stats.growthTrend > 0 ? "text-emerald-400" : stats.growthTrend < 0 ? "text-red-400" : "text-white"
          }`}>
            {stats.growthTrend > 0 ? "+" : ""}{stats.growthTrend.toFixed(0)}%
          </div>
          <div className="text-xs text-white/40 mt-1">vs previous week</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">Cumulative Users & Daily New</h3>

        {isLoading && dailyData.length === 0 ? (
          <div className="h-72 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full" />
              <div className="text-white/60">Loading user data...</div>
            </div>
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-2 flex justify-center"><ErrorIcon size={32} /></div>
              <div className="text-red-300 font-semibold mb-1">Error loading data</div>
              <div className="text-white/60 text-sm">{error.message}</div>
            </div>
          </div>
        ) : dailyData.length === 0 ? (
          <div className="h-72 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">👥</div>
              <div className="text-white font-semibold text-lg mb-2">No User Data</div>
              <div className="text-white/60 text-sm">
                No participant activity found in this time range.
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={dailyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id={cumGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="cumulative"
                orientation="left"
                tick={{ fill: "#22d3ee", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <YAxis
                yAxisId="daily"
                orientation="right"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "12px",
                }}
                labelStyle={{ color: "#fff", fontWeight: "bold" }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    uniqueAddresses: "Total Users",
                    newAddresses: "New Users",
                    activeAddresses: "Active Users",
                  };
                  return [value, labels[name] || name];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "16px" }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    uniqueAddresses: "Cumulative Users",
                    newAddresses: "New Users",
                    activeAddresses: "Active Today",
                  };
                  return <span className="text-white/80 text-sm">{labels[value] || value}</span>;
                }}
              />
              {/* Cumulative area */}
              <Area
                yAxisId="cumulative"
                type="monotone"
                dataKey="uniqueAddresses"
                stroke="#22d3ee"
                strokeWidth={2}
                fill={`url(#${cumGradientId})`}
                name="uniqueAddresses"
                {...animationProps}
              />
              {/* New users bars */}
              <Bar
                yAxisId="daily"
                dataKey="newAddresses"
                fill="#10b981"
                radius={[2, 2, 0, 0]}
                name="newAddresses"
                opacity={0.8}
                {...animationProps}
              />
              {/* Active users bars */}
              <Bar
                yAxisId="daily"
                dataKey="activeAddresses"
                fill="#6366f1"
                radius={[2, 2, 0, 0]}
                name="activeAddresses"
                opacity={0.5}
                {...animationProps}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Insight */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Adoption Curve</span>
            <p className="mt-1">
              A steepening cumulative line means accelerating adoption. Flattening means the pool has
              reached its current addressable market.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Retention</span>
            <p className="mt-1">
              Compare daily active vs total users. A high ratio means good retention. If total grows
              but active stays flat, users are depositing and leaving.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Growth Health</span>
            <p className="mt-1">
              {stats.growthTrend > 0
                ? <>New user acquisition is up {stats.growthTrend.toFixed(0)}% vs last week. Healthy growth signal.</>
                : stats.growthTrend < -20
                  ? <>New user acquisition declining. May need incentives or marketing push.</>
                  : <>New user growth is stable. Consistent onboarding is a positive sign.</>
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserGrowthChart;
