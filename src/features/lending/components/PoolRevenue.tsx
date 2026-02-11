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
  fetchProtocolFeesIncreased,
  type ProtocolFeesIncreasedEventResponse,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import { ErrorIcon } from "../../../components/ThemedIcons";
import type { PoolOverview } from "../types";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";
import { useAssetPrice } from "../../../hooks/useAssetPrice";
import { UsdToggle, type ValueMode } from "../../../components/UsdToggle";

interface PoolRevenueProps {
  pool: PoolOverview;
}

interface DailyRevenueData {
  date: string;
  timestamp: number;
  totalFees: number;
  referralFees: number;
  maintainerFees: number;
  protocolFees: number;
  cumulativeFees: number;
}

export function PoolRevenue({ pool }: PoolRevenueProps) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [dailyData, setDailyData] = React.useState<DailyRevenueData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const [valueMode, setValueMode] = React.useState<ValueMode>("native");
  const { price: usdPrice } = useAssetPrice(pool.asset);
  const mul = valueMode === "usd" ? usdPrice : 1;
  const unit = valueMode === "usd" ? "USD" : pool.asset;
  const prefix = valueMode === "usd" ? "$" : "";

  const { animationProps } = useChartFirstRender(dailyData.length > 0);
  const cumulativeGradientId = useStableGradientId('revenueGradient');

  const decimals = pool.contracts?.coinDecimals ?? 9;
  const poolId = pool.contracts?.marginPoolId;

  // Fetch protocol fees increased events
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

        const feesEvents = await fetchProtocolFeesIncreased(params);

        // Group by day
        const dayMap = new Map<string, DailyRevenueData>();

        feesEvents.forEach((e) => {
          const date = new Date(e.checkpoint_timestamp_ms).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" }
          );

          const existing = dayMap.get(date) || {
            date,
            timestamp: e.checkpoint_timestamp_ms,
            totalFees: 0,
            referralFees: 0,
            maintainerFees: 0,
            protocolFees: 0,
            cumulativeFees: 0,
          };

          const referralFee = parseFloat(e.referral_fees) / 10 ** decimals;
          const maintainerFee = parseFloat(e.maintainer_fees) / 10 ** decimals;
          const protocolFee = parseFloat(e.protocol_fees) / 10 ** decimals;
          const total = referralFee + maintainerFee + protocolFee;

          existing.referralFees += referralFee;
          existing.maintainerFees += maintainerFee;
          existing.protocolFees += protocolFee;
          existing.totalFees += total;
          existing.timestamp = Math.max(existing.timestamp, e.checkpoint_timestamp_ms);
          dayMap.set(date, existing);
        });

        // Sort and calculate cumulative
        const sorted = Array.from(dayMap.values()).sort(
          (a, b) => a.timestamp - b.timestamp
        );

        let cumulative = 0;
        sorted.forEach((d) => {
          cumulative += d.totalFees;
          d.cumulativeFees = cumulative;
        });

        setDailyData(sorted);
      } catch (err) {
        console.error("Error fetching revenue data:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [timeRange, poolId, decimals, serverUrl]);

  // Stats
  const stats = React.useMemo(() => {
    const totalRevenue = dailyData.reduce((sum, d) => sum + d.totalFees, 0);
    const totalProtocol = dailyData.reduce((sum, d) => sum + d.protocolFees, 0);
    const totalMaintainer = dailyData.reduce((sum, d) => sum + d.maintainerFees, 0);
    const totalReferral = dailyData.reduce((sum, d) => sum + d.referralFees, 0);
    const avgDailyRevenue = dailyData.length > 0 ? totalRevenue / dailyData.length : 0;
    const peakDaily = dailyData.length > 0 ? Math.max(...dailyData.map((d) => d.totalFees)) : 0;

    return {
      totalRevenue,
      totalProtocol,
      totalMaintainer,
      totalReferral,
      avgDailyRevenue,
      peakDaily,
    };
  }, [dailyData]);

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + "K";
    if (Math.abs(num) >= 1) return num.toFixed(2);
    return num.toFixed(4);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Pool Revenue
          </h2>
          <p className="text-sm text-white/60">
            Protocol fees earned from interest charges for {pool.asset}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <UsdToggle mode={valueMode} onChange={setValueMode} asset={pool.asset} priceUnavailable={usdPrice === 0} />
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-teal-500/30">
          <div className="text-sm text-white/60 mb-1">Total Fees ({timeRange})</div>
          <div className="text-xl font-bold text-teal-400">
            {prefix}{formatNumber(stats.totalRevenue * mul)}
          </div>
          <div className="text-xs text-white/40 mt-1">{unit}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Avg Daily</div>
          <div className="text-xl font-bold text-cyan-300">
            {prefix}{formatNumber(stats.avgDailyRevenue * mul)}
          </div>
          <div className="text-xs text-white/40 mt-1">{unit} / day</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Peak Daily</div>
          <div className="text-xl font-bold text-emerald-400">
            {prefix}{formatNumber(stats.peakDaily * mul)}
          </div>
          <div className="text-xs text-white/40 mt-1">{unit}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Protocol Share</div>
          <div className="text-xl font-bold text-purple-400">
            {stats.totalRevenue > 0
              ? ((stats.totalProtocol / stats.totalRevenue) * 100).toFixed(0)
              : 0}%
          </div>
          <div className="text-xs text-white/40 mt-1">of total fees</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">Daily Fees & Cumulative Revenue</h3>

        {isLoading && dailyData.length === 0 ? (
          <div className="h-72 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
              <div className="text-white/60">Loading revenue data...</div>
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
              <div className="text-6xl mb-4">💰</div>
              <div className="text-white font-semibold text-lg mb-2">No Revenue Data</div>
              <div className="text-white/60 text-sm">
                No protocol fee events found in this time range. Revenue accrues when interest is charged to borrowers.
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={dailyData}
              margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
            >
              <defs>
                <linearGradient id={cumulativeGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="cumulative"
                orientation="left"
                tickFormatter={(v) => formatNumber(v)}
                tick={{ fill: "#2dd4bf", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <YAxis
                yAxisId="daily"
                orientation="right"
                tickFormatter={(v) => formatNumber(v)}
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
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    cumulativeFees: "Cumulative",
                    protocolFees: "Protocol",
                    maintainerFees: "Maintainer",
                    referralFees: "Referral",
                  };
                  return [`${prefix}${formatNumber(value * mul)} ${unit}`, labels[name] || name];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "16px" }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    cumulativeFees: "Cumulative",
                    protocolFees: "Protocol Fees",
                    maintainerFees: "Maintainer Fees",
                    referralFees: "Referral Fees",
                  };
                  return <span className="text-white/80 text-sm">{labels[value] || value}</span>;
                }}
              />
              {/* Cumulative Area */}
              <Area
                yAxisId="cumulative"
                type="monotone"
                dataKey="cumulativeFees"
                stroke="#2dd4bf"
                strokeWidth={2}
                fill={`url(#${cumulativeGradientId})`}
                name="cumulativeFees"
                {...animationProps}
              />
              {/* Stacked daily bars */}
              <Bar
                yAxisId="daily"
                dataKey="protocolFees"
                stackId="daily"
                fill="#a855f7"
                radius={[0, 0, 0, 0]}
                name="protocolFees"
                {...animationProps}
              />
              <Bar
                yAxisId="daily"
                dataKey="maintainerFees"
                stackId="daily"
                fill="#22d3ee"
                radius={[0, 0, 0, 0]}
                name="maintainerFees"
                {...animationProps}
              />
              <Bar
                yAxisId="daily"
                dataKey="referralFees"
                stackId="daily"
                fill="#f59e0b"
                radius={[2, 2, 0, 0]}
                name="referralFees"
                {...animationProps}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Fee Breakdown */}
      {stats.totalRevenue > 0 && (
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-cyan-200 mb-4">Fee Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: "Protocol Fees", value: stats.totalProtocol, color: "bg-purple-500", pct: (stats.totalProtocol / stats.totalRevenue) * 100 },
              { label: "Maintainer Fees", value: stats.totalMaintainer, color: "bg-cyan-500", pct: (stats.totalMaintainer / stats.totalRevenue) * 100 },
              { label: "Referral Fees", value: stats.totalReferral, color: "bg-amber-500", pct: (stats.totalReferral / stats.totalRevenue) * 100 },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                <span className="text-sm text-white/60 w-32">{item.label}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-white/80 w-24 text-right">
                  {prefix}{formatNumber(item.value * mul)} {unit}
                </span>
                <span className="text-xs text-white/40 w-12 text-right">
                  {item.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight Box */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Absolute Earnings</span>
            <p className="mt-1">
              Unlike APY percentages, this shows the actual fees generated. A high APY on a small pool
              may earn less than a moderate APY on a large pool.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Fee Split</span>
            <p className="mt-1">
              Protocol fees go to the treasury, maintainer fees compensate pool operators, and referral
              fees reward users who bring liquidity. The remainder goes to suppliers as yield.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Revenue Trend</span>
            <p className="mt-1">
              {stats.avgDailyRevenue > 0 ? (
                <>Averaging {formatNumber(stats.avgDailyRevenue)} {pool.asset}/day. Growing revenue signals increasing protocol adoption.</>
              ) : (
                <>No revenue data in this period. Revenue begins when borrowers pay interest.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
