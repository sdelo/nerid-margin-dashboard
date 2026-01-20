import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import type { PoolOverview } from "../types";
import { ChevronDownIcon, ChevronUpIcon, CalculatorIcon } from "@heroicons/react/24/outline";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

interface FloatingCalculatorProps {
  pool: PoolOverview;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Generate data points for the chart (weekly intervals up to 1 year)
function generateProjectionData(
  depositAmount: number,
  currentAPY: number,
  lowAPY: number,
  highAPY: number
) {
  const dataPoints: {
    day: number;
    label: string;
    current: number;
    low: number;
    high: number;
  }[] = [];

  // Time intervals: daily for first week, weekly for first month, then monthly
  const intervals = [
    { day: 1, label: "1d" },
    { day: 7, label: "1w" },
    { day: 14, label: "2w" },
    { day: 30, label: "1m" },
    { day: 60, label: "2m" },
    { day: 90, label: "3m" },
    { day: 180, label: "6m" },
    { day: 270, label: "9m" },
    { day: 365, label: "1y" },
  ];

  for (const { day, label } of intervals) {
    // Compound interest calculation
    const currentDailyRate = currentAPY / 100 / 365;
    const lowDailyRate = lowAPY / 100 / 365;
    const highDailyRate = highAPY / 100 / 365;

    const currentValue = depositAmount * Math.pow(1 + currentDailyRate, day);
    const lowValue = depositAmount * Math.pow(1 + lowDailyRate, day);
    const highValue = depositAmount * Math.pow(1 + highDailyRate, day);

    dataPoints.push({
      day,
      label,
      current: currentValue,
      low: lowValue,
      high: highValue,
    });
  }

  return dataPoints;
}

export function FloatingCalculator({
  pool,
  isCollapsed = false,
  onToggleCollapse,
}: FloatingCalculatorProps) {
  const [amount, setAmount] = React.useState<string>("1000");
  const [internalCollapsed, setInternalCollapsed] = React.useState(isCollapsed);
  const [isAssumptionsExpanded, setIsAssumptionsExpanded] = React.useState(false);
  const [selectedPoint, setSelectedPoint] = React.useState<{
    day: number;
    label: string;
    current: number;
    low: number;
    high: number;
  } | null>(null);

  const collapsed = onToggleCollapse ? isCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse ?? (() => setInternalCollapsed(!internalCollapsed));

  const currentAPY = pool.ui?.aprSupplyPct ?? 0;

  // Calculate APY range based on utilization curve
  const ic = pool.protocolConfig?.interest_config;
  const mc = pool.protocolConfig?.margin_pool_config;

  let optimisticAPY = currentAPY;
  let pessimisticAPY = currentAPY;
  let highUtilizationPct = 0;
  let lowUtilizationPct = 0;

  if (ic && mc) {
    const optimalU = ic.optimal_utilization;
    const baseRate = ic.base_rate;
    const baseSlope = ic.base_slope;
    const spread = mc.protocol_spread;

    // Optimistic: utilization goes to optimal
    const optimalBorrowAPY = baseRate + baseSlope * optimalU;
    const calculatedOptimisticAPY = optimalBorrowAPY * optimalU * (1 - spread) * 100;

    // Pessimistic: utilization drops to 25% of optimal
    const lowUtil = optimalU * 0.25;
    const lowBorrowAPY = baseRate + baseSlope * lowUtil;
    const calculatedPessimisticAPY = lowBorrowAPY * lowUtil * (1 - spread) * 100;

    // Ensure high is always >= current and low is always <= current
    // This prevents the confusing case where "low" is higher than "current"
    optimisticAPY = Math.max(calculatedOptimisticAPY, currentAPY);
    // Low is min of calculated pessimistic OR current minus 20%
    pessimisticAPY = Math.min(calculatedPessimisticAPY, currentAPY * 0.8);

    // Store utilization percentages for display
    highUtilizationPct = optimalU * 100;
    lowUtilizationPct = lowUtil * 100;
  }

  const depositAmount = parseFloat(amount) || 0;
  const chartData = React.useMemo(
    () => generateProjectionData(depositAmount, currentAPY, pessimisticAPY, optimisticAPY),
    [depositAmount, currentAPY, pessimisticAPY, optimisticAPY]
  );

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(chartData.length > 0);
  const highGradientId = useStableGradientId('colorHigh');
  const currentGradientId = useStableGradientId('colorCurrent');
  const lowGradientId = useStableGradientId('colorLow');

  // Calculate stats for display
  const dailyEarnings = (depositAmount * (currentAPY / 100)) / 365;
  const monthlyEarnings = (depositAmount * (currentAPY / 100)) / 12;
  const yearlyTotal = depositAmount * (1 + currentAPY / 100);

  // Format number with appropriate precision
  const formatValue = (num: number) => {
    if (num < 0.01) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatEarnings = (num: number) => {
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (absNum >= 1000) return sign + absNum.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (absNum >= 1) return sign + absNum.toFixed(2);
    if (absNum >= 0.01) return sign + absNum.toFixed(4);
    if (absNum >= 0.0001) return sign + absNum.toFixed(6);
    if (absNum === 0) return '0';
    return sign + absNum.toFixed(8);
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string; dataKey?: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      // Find the "current" projection value for earnings calculation
      const currentProjection = payload.find(p => p.dataKey === 'current');
      const currentEarnings = currentProjection ? currentProjection.value - depositAmount : 0;
      
      // Sort by value descending (high, current, low)
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
      
      return (
        <div 
          className="rounded-xl shadow-2xl backdrop-blur-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 20, 30, 0.98) 100%)',
            border: '1px solid rgba(34, 211, 238, 0.15)',
            padding: '12px 14px',
            minWidth: '190px',
          }}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-2.5 pb-2 border-b border-white/[0.06]">
            At {label}
          </p>
          <div className="space-y-1.5">
            {sortedPayload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-medium" style={{ color: entry.color }}>
                  {entry.name}
                </span>
                <span className="text-xs font-mono tabular-nums" style={{ color: entry.color }}>
                  {formatValue(entry.value)} {pool.asset}
                </span>
              </div>
            ))}
          </div>
          {currentEarnings > 0 && (
            <div className="mt-2.5 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">Earned (current)</span>
                <span className="text-xs font-mono text-emerald-400">+{formatEarnings(currentEarnings)}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (collapsed) {
    return (
      <button
        onClick={toggleCollapse}
        className="sticky top-24 w-full bg-gradient-to-r from-cyan-900/40 to-indigo-900/40 border border-cyan-500/30 rounded-xl p-4 flex items-center justify-between hover:border-cyan-400/50 transition-all shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <CalculatorIcon className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Earnings Calculator</div>
            <div className="text-xs text-cyan-300/60">Click to expand</div>
          </div>
        </div>
        <ChevronDownIcon className="w-5 h-5 text-cyan-400" />
      </button>
    );
  }

  return (
    <div className="sticky top-24 bg-gradient-to-br from-cyan-900/30 via-slate-900/50 to-indigo-900/30 rounded-2xl border border-cyan-500/30 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <CalculatorIcon className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Earnings Calculator</h3>
              <p className="text-xs text-cyan-300/60">Project your returns over time</p>
            </div>
          </div>
          <button
            onClick={toggleCollapse}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ChevronUpIcon className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-b border-white/5">
        <label className="text-xs text-white/60 mb-1.5 block">Deposit Amount</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all pr-20"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 font-medium">
            {pool.asset}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div className="text-xs text-white/50 mb-2">Projected Value Over Time</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              onMouseMove={(e) => {
                if (e.activePayload && e.activePayload[0]) {
                  setSelectedPoint(e.activePayload[0].payload);
                }
              }}
              onMouseLeave={() => setSelectedPoint(null)}
            >
              <defs>
                <linearGradient id={highGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={currentGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id={lowGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => {
                  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
                  if (v >= 100) return v.toFixed(0);
                  if (v >= 10) return v.toFixed(1);
                  if (v >= 1) return v.toFixed(2);
                  return v.toFixed(2);
                }}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={48}
                domain={['dataMin - 10', 'dataMax + 10']}
                tickCount={5}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                iconType="line"
              />
              <Area
                type="monotone"
                dataKey="high"
                name={`High (${optimisticAPY.toFixed(1)}%)`}
                stroke="#22d3ee"
                fill={`url(#${highGradientId})`}
                strokeWidth={1.5}
                dot={false}
                {...animationProps}
              />
              <Area
                type="monotone"
                dataKey="current"
                name={`Current (${currentAPY.toFixed(1)}%)`}
                stroke="#10b981"
                fill={`url(#${currentGradientId})`}
                strokeWidth={2}
                dot={false}
                {...animationProps}
              />
              <Area
                type="monotone"
                dataKey="low"
                name={`Low (${pessimisticAPY.toFixed(1)}%)`}
                stroke="#6366f1"
                fill={`url(#${lowGradientId})`}
                strokeWidth={1.5}
                dot={false}
                {...animationProps}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-white/50 mb-1">Daily</div>
            <div className="text-sm font-semibold text-emerald-400">
              +{formatEarnings(dailyEarnings)}
            </div>
            <div className="text-[10px] text-white/40">{pool.asset}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-white/50 mb-1">Monthly</div>
            <div className="text-sm font-semibold text-emerald-400">
              +{formatEarnings(monthlyEarnings)}
            </div>
            <div className="text-[10px] text-white/40">{pool.asset}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-white/50 mb-1">1 Year Total</div>
            <div className="text-sm font-semibold text-cyan-400">
              {formatValue(yearlyTotal)}
            </div>
            <div className="text-[10px] text-white/40">{pool.asset}</div>
          </div>
        </div>

        {/* Current APY Badge */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-xs text-white/50">Current APY:</span>
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold">
            {currentAPY.toFixed(2)}%
          </span>
        </div>

        {/* Expandable Assumptions */}
        <div className="mt-3">
          <button
            onClick={() => setIsAssumptionsExpanded(!isAssumptionsExpanded)}
            className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
          >
            <ChevronDownIcon className={`w-3 h-3 transition-transform ${isAssumptionsExpanded ? 'rotate-180' : ''}`} />
            <span>Scenario Assumptions</span>
          </button>
          
          {isAssumptionsExpanded && (
            <div className="mt-2 px-2.5 py-2 bg-slate-800/50 rounded-lg border border-slate-700/30 text-[10px] text-slate-400 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="w-2 h-0.5 bg-cyan-400 mt-1.5 flex-shrink-0 rounded-full"></span>
                <div>
                  <span className="text-cyan-300 font-medium">High ({optimisticAPY.toFixed(1)}% APY)</span>
                  <span className="text-slate-500"> — Utilization at optimal{highUtilizationPct > 0 ? ` (~${highUtilizationPct.toFixed(0)}%)` : ''}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-0.5 bg-emerald-400 mt-1.5 flex-shrink-0 rounded-full"></span>
                <div>
                  <span className="text-emerald-300 font-medium">Current ({currentAPY.toFixed(1)}% APY)</span>
                  <span className="text-slate-500"> — Today's actual rate</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-0.5 bg-indigo-400 mt-1.5 flex-shrink-0 rounded-full"></span>
                <div>
                  <span className="text-indigo-300 font-medium">Low ({pessimisticAPY.toFixed(1)}% APY)</span>
                  <span className="text-slate-500"> — Low demand{lowUtilizationPct > 0 ? ` (~${lowUtilizationPct.toFixed(0)}% util)` : ''}</span>
                </div>
              </div>
              <p className="text-slate-500 pt-1 border-t border-slate-700/30 italic">
                APY varies with pool utilization. Projections compound daily.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FloatingCalculator;
