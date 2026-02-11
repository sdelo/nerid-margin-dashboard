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
  type TooltipProps,
} from "recharts";
import { usePoolHistoricalState } from "../hooks/usePoolHistoricalState";
import { type TimeRange } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import type { PoolOverview } from "../types";
import { calculatePoolRates } from "../../../utils/interestRates";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

interface CompositeRiskScoreProps {
  pool: PoolOverview;
}

interface RiskDataPoint {
  date: string;
  timestamp: number;
  riskScore: number;          // 0-100 composite (lower = safer)
  // Raw sub-scores (0-100 each, for the stat cards / tooltip)
  utilizationRisk: number;
  concentrationRisk: number;
  liquidityRisk: number;
  rateRisk: number;
  // Weighted contributions (these stack to ≈ riskScore)
  wUtil: number;
  wLiq: number;
  wRate: number;
  wConc: number;
  // Context values (for tooltip)
  utilization: number;        // actual utilization %
  availLiqPct: number;        // available liquidity as % of supply
}

// Weight constants
const W_UTIL = 0.35;
const W_LIQ = 0.30;
const W_RATE = 0.20;
const W_CONC = 0.15;

// Colors for each component
const COLORS = {
  util: "#f59e0b",   // amber
  liq: "#8b5cf6",    // purple
  rate: "#ef4444",   // red
  conc: "#64748b",   // slate
};

/**
 * Composite Risk Score — combines utilization, liquidity buffer, and rate model
 * proximity into a single 0-100 score displayed over time.
 *
 * The chart uses **stacked areas** so each factor's weighted contribution is
 * visually distinguishable, making it clear what drives the score.
 */
export function CompositeRiskScore({ pool }: CompositeRiskScoreProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const { data: histData, isLoading, error } = usePoolHistoricalState(pool, timeRange);

  const liveRates = React.useMemo(() => calculatePoolRates(pool), [pool]);

  // Compute risk scores for each day
  const riskData = React.useMemo((): RiskDataPoint[] => {
    if (histData.length === 0) return [];

    // Get kink point from pool config (if available)
    const kinkBps = pool.config?.kink ?? 8000; // default 80%
    const kinkPct = kinkBps / 100;

    return histData.map((d) => {
      // 1) Utilization Risk: linear 0-100, spikes near kink
      const util = d.utilization;
      let utilizationRisk: number;
      if (util <= kinkPct * 0.6) {
        utilizationRisk = (util / (kinkPct * 0.6)) * 20; // 0-20 in safe zone
      } else if (util <= kinkPct) {
        utilizationRisk = 20 + ((util - kinkPct * 0.6) / (kinkPct * 0.4)) * 30; // 20-50 approaching kink
      } else {
        utilizationRisk = 50 + ((util - kinkPct) / (100 - kinkPct)) * 50; // 50-100 above kink
      }
      utilizationRisk = Math.min(100, Math.max(0, utilizationRisk));

      // 2) Liquidity Risk: based on available liquidity as % of supply
      const availPct = d.supply > 0 ? (d.availableLiquidity / d.supply) * 100 : 100;
      let liquidityRisk: number;
      if (availPct > 50) liquidityRisk = 0;
      else if (availPct > 20) liquidityRisk = ((50 - availPct) / 30) * 50; // 0-50
      else liquidityRisk = 50 + ((20 - availPct) / 20) * 50; // 50-100
      liquidityRisk = Math.min(100, Math.max(0, liquidityRisk));

      // 3) Rate Risk: based on how high the borrow rate is
      const rateRisk = Math.min(100, util * 0.8);

      // 4) Concentration Risk: static (would need per-day concentration data)
      const concentrationRisk = 30;

      // Weighted contributions
      const wUtil = utilizationRisk * W_UTIL;
      const wLiq = liquidityRisk * W_LIQ;
      const wRate = rateRisk * W_RATE;
      const wConc = concentrationRisk * W_CONC;

      const riskScore = Math.min(100, Math.max(0, wUtil + wLiq + wRate + wConc));

      return {
        date: d.date,
        timestamp: d.timestamp,
        riskScore: Math.round(riskScore * 10) / 10,
        utilizationRisk: Math.round(utilizationRisk * 10) / 10,
        concentrationRisk: Math.round(concentrationRisk * 10) / 10,
        liquidityRisk: Math.round(liquidityRisk * 10) / 10,
        rateRisk: Math.round(rateRisk * 10) / 10,
        wUtil: Math.round(wUtil * 10) / 10,
        wLiq: Math.round(wLiq * 10) / 10,
        wRate: Math.round(wRate * 10) / 10,
        wConc: Math.round(wConc * 10) / 10,
        utilization: Math.round(d.utilization * 10) / 10,
        availLiqPct: Math.round(availPct * 10) / 10,
      };
    });
  }, [histData, pool.config]);

  const { animationProps } = useChartFirstRender(riskData.length > 0);
  const utilGradId = useStableGradientId("riskUtilGrad");
  const liqGradId = useStableGradientId("riskLiqGrad");
  const rateGradId = useStableGradientId("riskRateGrad");
  const concGradId = useStableGradientId("riskConcGrad");

  // Current risk score (last point)
  const currentRisk = riskData.length > 0 ? riskData[riskData.length - 1] : null;
  const avgRisk =
    riskData.length > 0
      ? riskData.reduce((sum, d) => sum + d.riskScore, 0) / riskData.length
      : 0;

  const getRiskLabel = (score: number) => {
    if (score >= 70) return { label: "High Risk", color: "text-red-400", bg: "bg-red-500" };
    if (score >= 40) return { label: "Moderate", color: "text-amber-400", bg: "bg-amber-500" };
    return { label: "Low Risk", color: "text-emerald-400", bg: "bg-emerald-500" };
  };

  const riskInfo = currentRisk ? getRiskLabel(currentRisk.riskScore) : getRiskLabel(0);

  // Custom tooltip showing the full breakdown
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as RiskDataPoint | undefined;
    if (!d) return null;

    const scoreInfo = getRiskLabel(d.riskScore);
    const barWidth = (val: number) => `${Math.min(100, Math.max(2, val))}%`;

    return (
      <div className="bg-slate-900/95 border border-white/20 rounded-xl p-4 shadow-xl min-w-[260px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-bold text-sm">{label}</span>
          <span className={`text-lg font-bold font-mono ${scoreInfo.color}`}>
            {d.riskScore.toFixed(0)}
          </span>
        </div>

        {/* Factor breakdown bars */}
        <div className="space-y-2.5">
          {/* Utilization */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-white/70">
                Utilization{" "}
                <span className="text-white/40">({(W_UTIL * 100).toFixed(0)}%)</span>
              </span>
              <span className="text-amber-400 font-mono font-medium">
                {d.utilizationRisk.toFixed(0)}{" "}
                <span className="text-white/30">→ +{d.wUtil.toFixed(1)}</span>
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: barWidth(d.utilizationRisk) }}
              />
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">
              Pool at {d.utilization.toFixed(1)}% utilization
            </div>
          </div>

          {/* Liquidity */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-white/70">
                Liquidity{" "}
                <span className="text-white/40">({(W_LIQ * 100).toFixed(0)}%)</span>
              </span>
              <span className="text-purple-400 font-mono font-medium">
                {d.liquidityRisk.toFixed(0)}{" "}
                <span className="text-white/30">→ +{d.wLiq.toFixed(1)}</span>
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: barWidth(d.liquidityRisk) }}
              />
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">
              {d.availLiqPct.toFixed(1)}% of supply available
            </div>
          </div>

          {/* Rate Stress */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-white/70">
                Rate Stress{" "}
                <span className="text-white/40">({(W_RATE * 100).toFixed(0)}%)</span>
              </span>
              <span className="text-red-400 font-mono font-medium">
                {d.rateRisk.toFixed(0)}{" "}
                <span className="text-white/30">→ +{d.wRate.toFixed(1)}</span>
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: barWidth(d.rateRisk) }}
              />
            </div>
          </div>

          {/* Concentration */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-white/70">
                Concentration{" "}
                <span className="text-white/40">({(W_CONC * 100).toFixed(0)}%)</span>
              </span>
              <span className="text-slate-400 font-mono font-medium">
                {d.concentrationRisk.toFixed(0)}{" "}
                <span className="text-white/30">→ +{d.wConc.toFixed(1)}</span>
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-500 rounded-full transition-all"
                style={{ width: barWidth(d.concentrationRisk) }}
              />
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">Static estimate</div>
          </div>
        </div>

        {/* Weighted sum */}
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
          <span className="text-white/50">Weighted total</span>
          <span className="text-white/70 font-mono">
            {d.wUtil.toFixed(1)} + {d.wLiq.toFixed(1)} + {d.wRate.toFixed(1)} + {d.wConc.toFixed(1)} ={" "}
            <span className={`font-bold ${scoreInfo.color}`}>{d.riskScore.toFixed(1)}</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Composite Risk Score</h2>
          <p className="text-sm text-white/60">
            Weighted risk metric combining utilization, liquidity, and rate factors
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Current Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div
          className={`bg-white/5 rounded-2xl p-4 border ${
            currentRisk && currentRisk.riskScore >= 70
              ? "border-red-500/30"
              : currentRisk && currentRisk.riskScore >= 40
                ? "border-amber-500/30"
                : "border-emerald-500/30"
          }`}
        >
          <div className="text-sm text-white/60 mb-1">Current Score</div>
          <div className={`text-3xl font-bold font-mono ${riskInfo.color}`}>
            {currentRisk?.riskScore.toFixed(0) ?? "—"}
          </div>
          <div className="text-xs text-white/40 mt-1">{riskInfo.label}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Utilization</div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {currentRisk?.utilizationRisk.toFixed(0) ?? "—"}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {(W_UTIL * 100).toFixed(0)}% wt → +{currentRisk?.wUtil.toFixed(1) ?? "0"}
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Liquidity</div>
          <div className="text-xl font-bold text-purple-400 font-mono">
            {currentRisk?.liquidityRisk.toFixed(0) ?? "—"}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {(W_LIQ * 100).toFixed(0)}% wt → +{currentRisk?.wLiq.toFixed(1) ?? "0"}
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Rate Stress</div>
          <div className="text-xl font-bold text-red-400 font-mono">
            {currentRisk?.rateRisk.toFixed(0) ?? "—"}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {(W_RATE * 100).toFixed(0)}% wt → +{currentRisk?.wRate.toFixed(1) ?? "0"}
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Period Average</div>
          <div className={`text-xl font-bold font-mono ${getRiskLabel(avgRisk).color}`}>
            {avgRisk.toFixed(0)}
          </div>
          <div className="text-xs text-white/40 mt-1">{timeRange} avg</div>
        </div>
      </div>

      {/* Stacked Area Chart */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-cyan-200">Risk Score Over Time</h3>
          <div className="text-[10px] text-white/30">Hover for breakdown</div>
        </div>

        {isLoading && riskData.length === 0 ? (
          <div className="h-72 flex items-center justify-center">
            <div className="flex items-center gap-3 text-white/60">
              <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              Loading risk data...
            </div>
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center text-red-300 text-sm">
            {error.message}
          </div>
        ) : riskData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-white/40 text-sm">
            No historical data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={riskData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id={utilGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.util} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={COLORS.util} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id={liqGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.liq} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={COLORS.liq} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id={rateGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.rate} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={COLORS.rate} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id={concGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.conc} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.conc} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Danger zone reference lines */}
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.3} />
              {/* Average */}
              <ReferenceLine
                y={avgRisk}
                stroke="rgba(255,255,255,0.3)"
                strokeDasharray="2 4"
                label={{
                  value: `avg ${avgRisk.toFixed(0)}`,
                  fill: "rgba(255,255,255,0.3)",
                  fontSize: 10,
                  position: "left",
                }}
              />

              {/* Stacked areas — bottom to top: Concentration, Rate, Liquidity, Utilization */}
              <Area
                type="monotone"
                dataKey="wConc"
                stackId="risk"
                stroke={COLORS.conc}
                strokeWidth={0}
                fill={`url(#${concGradId})`}
                name="Concentration"
                {...animationProps}
              />
              <Area
                type="monotone"
                dataKey="wRate"
                stackId="risk"
                stroke={COLORS.rate}
                strokeWidth={0}
                fill={`url(#${rateGradId})`}
                name="Rate Stress"
                {...animationProps}
              />
              <Area
                type="monotone"
                dataKey="wLiq"
                stackId="risk"
                stroke={COLORS.liq}
                strokeWidth={0}
                fill={`url(#${liqGradId})`}
                name="Liquidity"
                {...animationProps}
              />
              <Area
                type="monotone"
                dataKey="wUtil"
                stackId="risk"
                stroke={COLORS.util}
                strokeWidth={1}
                fill={`url(#${utilGradId})`}
                name="Utilization"
                {...animationProps}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Legend — factor colors matching the stacked areas */}
        <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t border-white/10 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-2 rounded-sm" style={{ background: COLORS.util }} />
            <span className="text-white/50">Utilization (35%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-2 rounded-sm" style={{ background: COLORS.liq }} />
            <span className="text-white/50">Liquidity (30%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-2 rounded-sm" style={{ background: COLORS.rate }} />
            <span className="text-white/50">Rate Stress (20%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-2 rounded-sm" style={{ background: COLORS.conc }} />
            <span className="text-white/50">Concentration (15%)</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-4 h-0 border-t border-dashed border-amber-500/50" />
            <span className="text-white/30">Moderate (40)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-4 h-0 border-t border-dashed border-red-500/50" />
            <span className="text-white/30">High (70)</span>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          How It's Calculated
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: COLORS.util }} />
              Utilization (35%)
            </span>
            <p className="mt-1">
              Higher utilization = more risk. Accelerates above the kink point (
              {(pool.config?.kink ?? 8000) / 100}% util) where borrow rates spike.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: COLORS.liq }} />
              Liquidity (30%)
            </span>
            <p className="mt-1">
              Available liquidity as a % of total supply. Below 20% liquidity, withdrawal risk
              rises sharply.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: COLORS.rate }} />
              Rate Stress (20%)
            </span>
            <p className="mt-1">
              High borrow rates pressure borrowers, increasing likelihood of liquidations.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: COLORS.conc }} />
              Concentration (15%)
            </span>
            <p className="mt-1">
              Static estimate of position concentration. See the Concentration tab for detailed
              analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompositeRiskScore;
