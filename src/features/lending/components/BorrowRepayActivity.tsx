import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  fetchLoanBorrowed,
  fetchLoanRepaid,
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
import { useChartFirstRender } from "../../../components/charts/StableChart";

interface BorrowRepayActivityProps {
  pool: PoolOverview;
}

interface DailyBorrowData {
  date: string;
  timestamp: number;
  borrows: number;
  repays: number;
  netChange: number;
  cumulativeDebt: number;
  borrowCount: number;
  repayCount: number;
}

export function BorrowRepayActivity({ pool }: BorrowRepayActivityProps) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [dailyData, setDailyData] = React.useState<DailyBorrowData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const decimals = pool.contracts?.coinDecimals ?? 9;
  const poolId = pool.contracts?.marginPoolId;

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

        const [borrowed, repaid] = await Promise.all([
          fetchLoanBorrowed(params),
          fetchLoanRepaid(params),
        ]);

        // Build daily aggregations
        const dayMap = new Map<string, DailyBorrowData>();

        // Process borrows
        borrowed.forEach((e) => {
          const date = new Date(e.checkpoint_timestamp_ms).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" }
          );
          const amount = parseFloat(e.loan_amount) / 10 ** decimals;

          const existing = dayMap.get(date) || {
            date,
            timestamp: e.checkpoint_timestamp_ms,
            borrows: 0,
            repays: 0,
            netChange: 0,
            cumulativeDebt: 0,
            borrowCount: 0,
            repayCount: 0,
          };

          existing.borrows += amount;
          existing.netChange += amount;
          existing.borrowCount += 1;
          existing.timestamp = Math.max(
            existing.timestamp,
            e.checkpoint_timestamp_ms
          );
          dayMap.set(date, existing);
        });

        // Process repays
        repaid.forEach((e) => {
          const date = new Date(e.checkpoint_timestamp_ms).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" }
          );
          const amount = parseFloat(e.repay_amount) / 10 ** decimals;

          const existing = dayMap.get(date) || {
            date,
            timestamp: e.checkpoint_timestamp_ms,
            borrows: 0,
            repays: 0,
            netChange: 0,
            cumulativeDebt: 0,
            borrowCount: 0,
            repayCount: 0,
          };

          existing.repays += amount;
          existing.netChange -= amount;
          existing.repayCount += 1;
          existing.timestamp = Math.max(
            existing.timestamp,
            e.checkpoint_timestamp_ms
          );
          dayMap.set(date, existing);
        });

        // Sort and calculate cumulative debt
        const sortedData = Array.from(dayMap.values()).sort(
          (a, b) => a.timestamp - b.timestamp
        );

        // Calculate cumulative debt going forward from 0
        // This shows the net effect of borrow/repay activity over time
        // Note: May differ from on-chain debt due to interest accrual or liquidations
        let runningDebt = 0;
        sortedData.forEach((day) => {
          runningDebt += day.netChange;
          day.cumulativeDebt = runningDebt;
        });

        setDailyData(sortedData);
      } catch (err) {
        console.error("Error fetching borrow/repay activity:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [timeRange, poolId, decimals, serverUrl, pool.state]);

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(dailyData.length > 0);

  // Calculate stats
  const stats = React.useMemo(() => {
    if (dailyData.length === 0) {
      return {
        totalBorrows: 0,
        totalRepays: 0,
        netChange: 0,
        avgDailyBorrow: 0,
        daysWithNetBorrow: 0,
        daysWithNetRepay: 0,
        totalBorrowTxns: 0,
        totalRepayTxns: 0,
      };
    }

    const totalBorrows = dailyData.reduce((sum, d) => sum + d.borrows, 0);
    const totalRepays = dailyData.reduce((sum, d) => sum + d.repays, 0);
    const netChange = totalBorrows - totalRepays;
    const avgDailyBorrow = totalBorrows / dailyData.length;
    const daysWithNetBorrow = dailyData.filter((d) => d.netChange > 0).length;
    const daysWithNetRepay = dailyData.filter((d) => d.netChange < 0).length;
    const totalBorrowTxns = dailyData.reduce((sum, d) => sum + d.borrowCount, 0);
    const totalRepayTxns = dailyData.reduce((sum, d) => sum + d.repayCount, 0);

    return {
      totalBorrows,
      totalRepays,
      netChange,
      avgDailyBorrow,
      daysWithNetBorrow,
      daysWithNetRepay,
      totalBorrowTxns,
      totalRepayTxns,
    };
  }, [dailyData]);

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + "K";
    return num.toFixed(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Borrow & Repay Activity
          </h2>
          <p className="text-sm text-white/60">
            Borrowing flows and outstanding debt for {pool.asset}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Current Debt - Live on-chain data */}
        <div className="bg-white/5 rounded-2xl p-4 border border-amber-500/30">
          <div className="text-sm text-white/60 mb-1">Outstanding Debt</div>
          <div className="text-xl font-bold text-amber-400">
            {formatNumber(pool.state?.borrow ?? 0)}
          </div>
          <div className="text-xs text-white/40 mt-1">{pool.asset} (on-chain)</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Borrows ({timeRange})</div>
          <div className="text-xl font-bold text-rose-400">
            +{formatNumber(stats.totalBorrows)}
          </div>
          <div className="text-xs text-white/40 mt-1">{stats.totalBorrowTxns} transactions</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Repays ({timeRange})</div>
          <div className="text-xl font-bold text-emerald-400">
            -{formatNumber(stats.totalRepays)}
          </div>
          <div className="text-xs text-white/40 mt-1">{stats.totalRepayTxns} transactions</div>
        </div>
        <div
          className={`bg-white/5 rounded-2xl p-4 border ${
            stats.netChange >= 0
              ? "border-rose-500/30"
              : "border-emerald-500/30"
          }`}
        >
          <div className="text-sm text-white/60 mb-1">Net Change ({timeRange})</div>
          <div
            className={`text-xl font-bold ${
              stats.netChange >= 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {stats.netChange >= 0 ? "+" : ""}
            {formatNumber(stats.netChange)}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {stats.netChange >= 0 ? "Debt growing" : "Debt shrinking"}
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Activity Balance</div>
          <div className="text-xl font-bold text-cyan-300">
            {stats.daysWithNetBorrow} / {stats.daysWithNetRepay}
          </div>
          <div className="text-xs text-white/40 mt-1">Net borrow / repay days</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-amber-200 mb-4">
          Daily Borrow/Repay & Debt Trend
        </h3>

        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-3 border-amber-500 border-t-transparent rounded-full"></div>
              <div className="text-white/60">Loading borrow/repay activity...</div>
            </div>
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center">
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
        ) : dailyData.length === 0 ? (
          <div className="h-80 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">📊</div>
              <div className="text-white font-semibold text-lg mb-2">
                No Borrowing Activity Yet
              </div>
              <div className="text-white/60 text-sm">
                No borrows or repays recorded in this time range.
                Borrowing activity will appear here when traders open positions.
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={dailyData}
              margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
            >
              <defs>
                <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
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
                yAxisId="debt"
                orientation="left"
                tickFormatter={(v) => formatNumber(v)}
                tick={{ fill: "#fbbf24", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
                label={{
                  value: "Net Borrowed",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#fbbf24", fontSize: 12, fontWeight: 500 },
                  offset: 10,
                }}
              />
              <YAxis
                yAxisId="flow"
                orientation="right"
                tickFormatter={(v) => formatNumber(v)}
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
                label={{
                  value: "Daily Borrow/Repay",
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 500 },
                  offset: 10,
                }}
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
                    borrows: "Borrowed (this day)",
                    repays: "Repaid (this day)",
                    cumulativeDebt: "Net Borrowed (cumulative)",
                  };
                  // Show absolute value for repays since it's displayed as negative bar
                  const displayValue = name === "repays" ? Math.abs(value) : value;
                  return [formatNumber(displayValue), labels[name] || name];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    borrows: "Borrowed",
                    repays: "Repaid",
                    cumulativeDebt: "Net Borrowed",
                  };
                  return (
                    <span className="text-white/80 text-sm">
                      {labels[value] || value}
                    </span>
                  );
                }}
              />
              <ReferenceLine
                yAxisId="flow"
                y={0}
                stroke="rgba(255,255,255,0.3)"
              />
              {/* Debt Line */}
              <Line
                yAxisId="debt"
                type="monotone"
                dataKey="cumulativeDebt"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={false}
                name="cumulativeDebt"
                {...animationProps}
              />
              {/* Borrow Bars */}
              <Bar
                yAxisId="flow"
                dataKey="borrows"
                fill="#f43f5e"
                radius={[2, 2, 0, 0]}
                name="borrows"
                opacity={0.8}
                {...animationProps}
              />
              {/* Repay Bars (negative) */}
              <Bar
                yAxisId="flow"
                dataKey={(d: DailyBorrowData) => -d.repays}
                fill="#10b981"
                radius={[0, 0, 2, 2]}
                name="repays"
                opacity={0.8}
                {...animationProps}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Insight Box */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Utilization Driver</span>
            <p className="mt-1">
              Borrow activity directly affects utilization and APY. More borrowing = higher utilization = higher supplier APY.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Debt Trend</span>
            <p className="mt-1">
              {stats.netChange > 0 ? (
                <>Debt grew by {formatNumber(Math.abs(stats.netChange))} {pool.asset}. Growing demand signals bullish sentiment.</>
              ) : stats.netChange < 0 ? (
                <>Debt decreased by {formatNumber(Math.abs(stats.netChange))} {pool.asset}. Traders are deleveraging.</>
              ) : (
                <>Stable debt indicates balanced borrow/repay activity.</>
              )}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Trading Activity</span>
            <p className="mt-1">
              {dailyData.length > 0 ? (
                <>{stats.totalBorrowTxns + stats.totalRepayTxns} transactions across {dailyData.length} active days. High activity = active trading market.</>
              ) : (
                <>No borrow/repay activity in this period.</>
              )}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Why It Matters</span>
            <p className="mt-1">
              Unlike liquidations, borrow/repay shows normal market operations. Sudden spikes may precede volatility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BorrowRepayActivity;
