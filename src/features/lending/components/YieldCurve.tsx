import type { FC } from "react";
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { PoolOverview } from "../types";
import { calculatePoolRates } from "../../../utils/interestRates";
import { InfoTooltip } from "../../../components/InfoTooltip";
import { useChartFirstRender } from "../../../components/charts/StableChart";

type Props = { 
  pool: PoolOverview;
  /** When true, hides the header — parent provides it */
  embedded?: boolean;
};

export const YieldCurve: FC<Props> = ({ pool, embedded = false }) => {
  // Basic error handling for malformed data
  if (
    !pool?.protocolConfig?.interest_config ||
    !pool?.protocolConfig?.margin_pool_config ||
    !pool?.state
  ) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-teal-300">Yield & Interest</h2>
        <div className="bg-slate-800/50 rounded-lg p-6 text-center">
          <div className="text-red-400 text-sm">Error: Invalid pool data structure</div>
        </div>
      </div>
    );
  }

  const ic = pool.protocolConfig.interest_config;
  const mc = pool.protocolConfig.margin_pool_config;

  // Use the shared calculation utility for consistent rates
  const { utilizationPct: utilPct, borrowApr, supplyApr } = calculatePoolRates(pool);
  const u = utilPct / 100; // 0..1 for chart calculations

  // Config values are in decimal format (0.15 = 15%), convert to percentages for display
  const baseRatePct = ic.base_rate * 100;
  const baseSlopePct = ic.base_slope * 100;
  const optimalU = ic.optimal_utilization; // Keep as decimal for chart calculations
  const optimalUPct = ic.optimal_utilization * 100;
  const excessSlopePct = ic.excess_slope * 100;
  // Note: spreadPct = mc.protocol_spread * 100 is used in supply APR calculation in interestRates.ts

  // Build data points to draw the piecewise linear curve in Recharts
  // APR values should be in percentage form for the chart
  const steps = 16;
  const curveData = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps; // utilization as decimal (0-1)
    // Calculate borrow APR using the same formula as interestRates.ts
    // baseRatePct, baseSlopePct, excessSlopePct are already in percentage form
    const apr =
      t <= optimalU
        ? baseRatePct + baseSlopePct * t
        : baseRatePct + baseSlopePct * optimalU + excessSlopePct * (t - optimalU);
    return { u: Math.round(t * 100), apr };
  });

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(curveData.length > 0);

  return (
    <div className="space-y-6">
      {/* Header - hidden when embedded in APYPanel */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Rate Model
            </h2>
            <p className="text-sm text-white/60">
              How rates change with utilization for {pool.asset}
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* HERO METRIC: Supply APY */}
        <div className="bg-white/5 rounded-2xl p-4 border border-teal-500/30">
          <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
            Supply APY <InfoTooltip tooltip="supplyAPY" />
          </div>
          <div className="text-xl font-bold text-teal-400">
            {supplyApr.toFixed(2)}%
          </div>
          <div className="text-xs text-white/40 mt-1">What suppliers earn</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
            Borrow APY <InfoTooltip tooltip="borrowAPR" />
          </div>
          <div className="text-xl font-bold text-amber-400">
            {borrowApr.toFixed(2)}%
          </div>
          <div className="text-xs text-white/40 mt-1">What borrowers pay</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
            Utilization <InfoTooltip tooltip="utilizationRate" />
          </div>
          <div className="text-xl font-bold text-white">
            {utilPct.toFixed(1)}%
          </div>
          <div className="text-xs text-white/40 mt-1">Borrow / supply</div>
        </div>
      </div>

      {/* Utilization Curve */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4 flex items-center gap-2">
          Utilization Curve
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
        </h3>
        <div className="relative">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={curveData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                {/* Gradient for the line */}
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
                  <stop offset={`${Math.min(u * 100, 100)}%`} stopColor="#22d3ee" stopOpacity={1} />
                  <stop offset={`${Math.min(u * 100 + 1, 100)}%`} stopColor="#22d3ee" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="u"
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${Math.round(v)}%`}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip
                formatter={(value) => [`${(value as number).toFixed(2)}%`, "APY"]}
                labelFormatter={(label) => `Utilization ${label}%`}
                contentStyle={{
                  backgroundColor: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
              />
              {/* Optimal utilization marker */}
              <ReferenceLine x={Math.round(optimalU * 100)} stroke="#fbbf24" strokeWidth={1.5} />
              {/* The curve with gradient */}
              <Line type="monotone" dataKey="apr" stroke="url(#lineGradient)" strokeWidth={2.5} dot={false} {...animationProps} />
              {/* Current position indicator */}
              <ReferenceLine x={Math.round(u * 100)} stroke="#67e8f9" strokeDasharray="3 3" />
              {/* Animated current position dot - using CSS class for animation */}
              <ReferenceDot 
                x={Math.round(u * 100)} 
                y={borrowApr} 
                r={5} 
                fill="#22d3ee" 
                stroke="rgba(34, 211, 238, 0.5)"
                strokeWidth={8}
                className="animate-chart-dot"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/40">Current:</span>
            <span className="text-cyan-400 font-medium">{utilPct.toFixed(1)}%</span>
          </div>
          {utilPct > optimalUPct && (
            <div className="text-xs text-teal-400">↑ Above optimal — rates elevated</div>
          )}
        </div>
      </div>

      {/* Rate Model Parameters */}
      <details className="group">
        <summary className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl cursor-pointer transition-colors list-none">
          <span className="text-sm text-white/60 font-medium">Rate Model Parameters</span>
          <ChevronDownIcon className="w-4 h-4 text-white/40 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
            <div className="text-sm text-white/60 mb-1">Base Rate</div>
            <div className="text-xl font-bold text-teal-400">{baseRatePct.toFixed(1)}%</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
            <div className="text-sm text-white/60 mb-1">Base Slope</div>
            <div className="text-xl font-bold text-teal-400">{baseSlopePct.toFixed(1)}%</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
            <div className="text-sm text-white/60 mb-1">Optimal</div>
            <div className="text-xl font-bold text-teal-400">{optimalUPct.toFixed(0)}%</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
            <div className="text-sm text-white/60 mb-1">Excess Slope</div>
            <div className="text-xl font-bold text-teal-400">{excessSlopePct.toFixed(1)}%</div>
          </div>
        </div>
      </details>

      {/* What This Tells You */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">The Kink Mechanism</span>
            <p className="mt-1">
              Rates climb gently until {optimalUPct.toFixed(0)}% utilization (the "kink"), then accelerate sharply. This incentivizes borrowers to repay and keeps liquidity available.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Your Current Position</span>
            <p className="mt-1">
              {utilPct < optimalUPct ? (
                <>Pool is below optimal utilization—rates are stable. More borrowing would increase your APY.</>
              ) : (
                <>Pool is above the kink—rates are elevated. Good for suppliers, but utilization may drop as borrowers repay.</>
              )}
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Rate Sensitivity</span>
            <p className="mt-1">
              Above {optimalUPct.toFixed(0)}%, each 1% utilization increase adds ~{(excessSlopePct / 100).toFixed(2)}% to borrow APR vs ~{(baseSlopePct / 100).toFixed(2)}% below it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YieldCurve;
