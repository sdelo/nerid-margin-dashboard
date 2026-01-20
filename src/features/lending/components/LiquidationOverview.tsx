import React from "react";
import {
  useAtRiskPositions,
  useRiskDistribution,
  type AtRiskPosition,
} from "../../../hooks/useAtRiskPositions";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import type { TimeRange } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";

interface LiquidationOverviewProps {
  onSelectTab: (tab: "positions" | "analytics" | "history" | "leaderboard") => void;
}

interface SimulationResult {
  priceChange: number;
  newLiquidatableCount: number;
  newAtRiskCount: number;
  totalNewDebtAtRiskUsd: number;
  positionsAffected: number;
}

// Tooltip definitions
const RISK_DEFINITIONS = {
  healthFactor: {
    metric: "Health Factor = Collateral Value / Debt Value. When HF < 1.05, positions can be liquidated.",
    healthy: "All positions have healthy collateral ratios. No immediate liquidation risk.",
    warning: "Some positions are approaching liquidation threshold. Monitor closely.",
    critical: "Positions are liquidatable now. Opportunity for liquidators to act.",
  },
  priceImpact: {
    metric: "Simulates how base asset price changes would affect liquidation opportunities.",
    sensitive: "Small price moves could trigger many liquidations. High opportunity during volatility.",
    stable: "Positions are well-collateralized. Would require significant price moves to trigger liquidations.",
  },
  badDebt: {
    metric: "Debt that couldn't be recovered because collateral was insufficient at liquidation time.",
    none: "No bad debt has occurred. All liquidations have been fully covered by collateral.",
    exists: "Bad debt exists—some borrower collateral didn't cover their debt.",
  },
};

/**
 * Calculate what price change would trigger the first liquidation
 */
function calculateDistanceToFirstLiquidation(
  positions: AtRiskPosition[]
): { priceDrop: number | null; priceIncrease: number | null } {
  let closestDropPct: number | null = null;
  let closestIncreasePct: number | null = null;

  positions.forEach((position) => {
    if (position.isLiquidatable) return;

    const threshold = position.liquidationThreshold;
    const collateral = position.collateralValueUsd;
    const debt = position.debtValueUsd;

    if (debt === 0) return;

    const netBaseExposure = position.baseAssetUsd - position.baseDebtUsd;

    if (Math.abs(netBaseExposure) > 0.01) {
      const targetCollateral = threshold * debt;
      const changeNeeded = (targetCollateral - collateral) / netBaseExposure;
      const pctChange = changeNeeded * 100;

      if (pctChange < 0 && (closestDropPct === null || pctChange > closestDropPct)) {
        closestDropPct = pctChange;
      } else if (pctChange > 0 && (closestIncreasePct === null || pctChange < closestIncreasePct)) {
        closestIncreasePct = pctChange;
      }
    }
  });

  return { priceDrop: closestDropPct, priceIncrease: closestIncreasePct };
}

/**
 * Simulate what happens to positions if prices change
 */
function simulatePositionsWithPriceChange(
  positions: AtRiskPosition[],
  basePriceChangePct: number
): SimulationResult {
  let newLiquidatableCount = 0;
  let newAtRiskCount = 0;
  let totalNewDebtAtRiskUsd = 0;
  let positionsAffected = 0;

  positions.forEach((position) => {
    const basePriceMultiplier = 1 + basePriceChangePct / 100;

    const newBaseAssetUsd = position.baseAssetUsd * basePriceMultiplier;
    const newQuoteAssetUsd = position.quoteAssetUsd;
    const newBaseDebtUsd = position.baseDebtUsd * basePriceMultiplier;
    const newQuoteDebtUsd = position.quoteDebtUsd;

    const newCollateralValueUsd = newBaseAssetUsd + newQuoteAssetUsd;
    const newDebtValueUsd = newBaseDebtUsd + newQuoteDebtUsd;

    const newRiskRatio = newDebtValueUsd > 0 ? newCollateralValueUsd / newDebtValueUsd : 999;

    const wasLiquidatable = position.isLiquidatable;
    const isNowLiquidatable = newRiskRatio <= position.liquidationThreshold;

    if (!wasLiquidatable && isNowLiquidatable) {
      positionsAffected++;
    }

    if (isNowLiquidatable) {
      newLiquidatableCount++;
      totalNewDebtAtRiskUsd += newDebtValueUsd;
    }

    const atRiskThreshold = position.liquidationThreshold * 1.2;
    if (newRiskRatio <= atRiskThreshold) {
      newAtRiskCount++;
    }
  });

  return {
    priceChange: basePriceChangePct,
    newLiquidatableCount,
    newAtRiskCount,
    totalNewDebtAtRiskUsd,
    positionsAffected,
  };
}

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Determine overall system health verdict
 */
function getSystemVerdict(
  distanceToLiquidation: { priceDrop: number | null; priceIncrease: number | null },
  liquidatableCount: number,
  atRiskCount: number,
  totalPositions: number
): { verdict: "robust" | "watch" | "fragile"; label: string } {
  if (liquidatableCount > 0) {
    return { verdict: "fragile", label: "Liquidatable" };
  }

  if (totalPositions === 0) {
    return { verdict: "robust", label: "Healthy" };
  }

  const closestDrop = distanceToLiquidation.priceDrop;
  const closestIncrease = distanceToLiquidation.priceIncrease;
  const closestMove = Math.min(
    closestDrop ? Math.abs(closestDrop) : 999,
    closestIncrease ? Math.abs(closestIncrease) : 999
  );

  if (closestMove < 5) {
    return { verdict: "fragile", label: "Critical" };
  }

  if (closestMove < 15 || atRiskCount > totalPositions * 0.3) {
    return { verdict: "watch", label: "Monitor" };
  }

  return { verdict: "robust", label: "Healthy" };
}

export function LiquidationOverview({ onSelectTab }: LiquidationOverviewProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("3M");
  
  const {
    positions,
    liquidatableCount,
    atRiskCount,
    totalDebtAtRiskUsd,
    isLoading,
    error,
  } = useAtRiskPositions();

  const riskDistribution = useRiskDistribution(positions);

  const distanceToLiquidation = React.useMemo(
    () => calculateDistanceToFirstLiquidation(positions),
    [positions]
  );

  const currentState = React.useMemo(
    () => simulatePositionsWithPriceChange(positions, 0),
    [positions]
  );

  // Pre-calculate price scenarios for mini chart
  const scenarios = React.useMemo(() => {
    const changes = [-20, -15, -10, -5, 0, 5, 10];
    return changes.map((change) => simulatePositionsWithPriceChange(positions, change));
  }, [positions]);

  const verdict = React.useMemo(
    () =>
      getSystemVerdict(
        distanceToLiquidation,
        liquidatableCount,
        atRiskCount,
        positions.length
      ),
    [distanceToLiquidation, liquidatableCount, atRiskCount, positions.length]
  );

  if (isLoading && positions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-center">
        <p className="text-rose-400 text-sm">Error loading risk data: {error.message}</p>
      </div>
    );
  }

  // Find max for sparkline scaling
  const maxLiquidatable = Math.max(...scenarios.map((s) => s.newLiquidatableCount), 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Liquidation Overview</h3>
          <p className="text-sm text-white/40 mt-0.5">Click any section to explore details</p>
        </div>
        <div className="flex items-center gap-4">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <span className="badge badge-live">Live</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SYSTEM STATUS STRIP - Hero treatment with verdict
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        className={`rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap backdrop-blur-sm ${
          verdict.verdict === "robust"
            ? "bg-emerald-500/10 border border-emerald-500/20"
            : verdict.verdict === "watch"
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-rose-500/10 border border-rose-500/20"
        }`}
      >
        {/* Left: Status pill + quick summary */}
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide shadow-lg ${
              verdict.verdict === "robust"
                ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                : verdict.verdict === "watch"
                  ? "bg-amber-500/30 text-amber-300 border border-amber-400/40"
                  : "bg-rose-500/30 text-rose-300 border border-rose-400/40"
            }`}
          >
            {verdict.label}
          </span>
          {liquidatableCount > 0 ? (
            <span className="text-sm text-white/80">
              <span className="font-bold text-rose-400">{liquidatableCount}</span> position{liquidatableCount !== 1 ? "s" : ""} liquidatable now
            </span>
          ) : positions.length > 0 && distanceToLiquidation.priceDrop !== null ? (
            <span className="text-sm text-white/70">
              First liquidation at{" "}
              <span className="font-semibold text-white">
                {Math.abs(distanceToLiquidation.priceDrop).toFixed(0)}%
              </span>{" "}
              price drop
            </span>
          ) : positions.length === 0 ? (
            <span className="text-sm text-white/70">No active borrowing positions</span>
          ) : null}
        </div>

        {/* Center: Inline KPIs */}
        <div className="flex items-center gap-4 text-xs text-white/60">
          <span>
            Total:{" "}
            <span className="font-semibold text-white">{positions.length}</span> positions
          </span>
          <span className="text-white/20">·</span>
          <span>
            At-Risk:{" "}
            <span className={`font-semibold ${atRiskCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {atRiskCount}
            </span>
          </span>
          <span className="text-white/20">·</span>
          <span>
            Debt at risk:{" "}
            <span className="font-semibold text-white">{formatUsd(totalDebtAtRiskUsd)}</span>
          </span>
        </div>

        {/* Right: CTA */}
        {liquidatableCount > 0 && (
          <button
            onClick={() => onSelectTab("positions")}
            className="px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg border border-cyan-400/30 transition-all"
          >
            View opportunities →
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 1: RISK STATUS - Three tiles
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Risk Status</span>
          </div>
          <button
            onClick={() => onSelectTab("analytics")}
            className="text-[10px] text-white/40 hover:text-purple-400 transition-colors"
          >
            Open Analytics →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Health Factor Distribution */}
          <div className="relative group/tile h-full">
            <button
              onClick={() => onSelectTab("analytics")}
              className="text-left w-full h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/50">Health Distribution</span>
                  <QuestionMarkCircleIcon className="w-3 h-3 text-white/30 group-hover/tile:text-cyan-400 transition-colors" />
                </div>
                <div
                  className={`badge text-[9px] ${
                    liquidatableCount > 0
                      ? "badge-danger"
                      : atRiskCount > 0
                        ? "badge-warning"
                        : "badge-success"
                  }`}
                >
                  {liquidatableCount > 0 ? "Critical" : atRiskCount > 0 ? "Warning" : "Healthy"}
                </div>
              </div>

              {/* Mini histogram */}
              <div className="flex items-end gap-0.5 h-8 mb-2">
                {riskDistribution.slice(0, 6).map((bucket, idx) => {
                  const maxCount = Math.max(...riskDistribution.map((b) => b.count), 1);
                  const height = bucket.count > 0 ? Math.max((bucket.count / maxCount) * 100, 15) : 5;
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-t transition-all"
                      style={{
                        height: `${height}%`,
                        backgroundColor: bucket.color,
                        opacity: bucket.count > 0 ? 1 : 0.3,
                      }}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-auto">
                <span className="text-lg font-semibold text-white font-mono">{positions.length}</span>
                <span className="text-[10px] text-white/30">positions tracked</span>
              </div>
              <span className="text-[10px] text-white/30 group-hover/tile:text-cyan-400 transition-colors">
                View distribution →
              </span>
            </button>
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 border border-cyan-500/30 rounded-lg shadow-xl opacity-0 group-hover/tile:opacity-100 transition-opacity pointer-events-none z-20">
              <p className="text-[11px] text-white/70 leading-relaxed">
                {liquidatableCount > 0
                  ? RISK_DEFINITIONS.healthFactor.critical
                  : atRiskCount > 0
                    ? RISK_DEFINITIONS.healthFactor.warning
                    : RISK_DEFINITIONS.healthFactor.healthy}
              </p>
              <p className="text-[10px] text-white/40 mt-2 pt-2 border-t border-white/[0.06]">
                {RISK_DEFINITIONS.healthFactor.metric}
              </p>
            </div>
          </div>

          {/* Price Sensitivity */}
          <div className="relative group/tile h-full">
            <button
              onClick={() => onSelectTab("analytics")}
              className="text-left w-full h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-amber-500/40 hover:bg-amber-500/5 transition-all flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/50">Price Sensitivity</span>
                  <QuestionMarkCircleIcon className="w-3 h-3 text-white/30 group-hover/tile:text-amber-400 transition-colors" />
                </div>
                <div
                  className={`badge text-[9px] ${
                    distanceToLiquidation.priceDrop !== null && Math.abs(distanceToLiquidation.priceDrop) < 10
                      ? "badge-danger"
                      : distanceToLiquidation.priceDrop !== null && Math.abs(distanceToLiquidation.priceDrop) < 20
                        ? "badge-warning"
                        : "badge-success"
                  }`}
                >
                  {distanceToLiquidation.priceDrop !== null && Math.abs(distanceToLiquidation.priceDrop) < 10
                    ? "Sensitive"
                    : distanceToLiquidation.priceDrop !== null && Math.abs(distanceToLiquidation.priceDrop) < 20
                      ? "Moderate"
                      : "Resilient"}
                </div>
              </div>

              {/* Mini sparkline showing liquidations at different price points */}
              <div className="flex items-end gap-0.5 h-8 mb-2">
                {scenarios.map((scenario, idx) => {
                  const height = scenario.newLiquidatableCount > 0
                    ? Math.max((scenario.newLiquidatableCount / maxLiquidatable) * 100, 15)
                    : 5;
                  const isCurrent = scenario.priceChange === 0;
                  return (
                    <div
                      key={idx}
                      className={`flex-1 rounded-t transition-all ${isCurrent ? "ring-1 ring-white/40" : ""}`}
                      style={{
                        height: `${height}%`,
                        backgroundColor:
                          scenario.priceChange < 0
                            ? scenario.newLiquidatableCount > 0
                              ? "#f43f5e"
                              : "#f43f5e40"
                            : scenario.priceChange > 0
                              ? scenario.newLiquidatableCount > 0
                                ? "#10b981"
                                : "#10b98140"
                              : "#64748b",
                      }}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-auto">
                {distanceToLiquidation.priceDrop !== null ? (
                  <>
                    <span className="text-lg font-semibold text-amber-400 font-mono">
                      {Math.abs(distanceToLiquidation.priceDrop).toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-white/30">to first liquidation</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-semibold text-emerald-400 font-mono">∞</span>
                    <span className="text-[10px] text-white/30">well collateralized</span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-white/30 group-hover/tile:text-amber-400 transition-colors">
                Open simulator →
              </span>
            </button>
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 border border-amber-500/30 rounded-lg shadow-xl opacity-0 group-hover/tile:opacity-100 transition-opacity pointer-events-none z-20">
              <p className="text-[11px] text-white/70 leading-relaxed">
                {distanceToLiquidation.priceDrop !== null && Math.abs(distanceToLiquidation.priceDrop) < 15
                  ? RISK_DEFINITIONS.priceImpact.sensitive
                  : RISK_DEFINITIONS.priceImpact.stable}
              </p>
              <p className="text-[10px] text-white/40 mt-2 pt-2 border-t border-white/[0.06]">
                {RISK_DEFINITIONS.priceImpact.metric}
              </p>
            </div>
          </div>

          {/* Liquidation Opportunity */}
          <div className="relative group/tile h-full">
            <button
              onClick={() => onSelectTab("positions")}
              className="text-left w-full h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-rose-500/40 hover:bg-rose-500/5 transition-all flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/50">Ready Now</span>
                  <QuestionMarkCircleIcon className="w-3 h-3 text-white/30 group-hover/tile:text-rose-400 transition-colors" />
                </div>
                {liquidatableCount > 0 && (
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className={`text-2xl font-bold font-mono ${
                    liquidatableCount > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {liquidatableCount}
                </span>
                <span className="text-[10px] text-white/30">liquidatable</span>
              </div>

              <div className="mt-auto">
                {liquidatableCount > 0 ? (
                  <div className="text-sm font-medium text-rose-300">
                    {formatUsd(currentState.totalNewDebtAtRiskUsd)} opportunity
                  </div>
                ) : (
                  <div className="text-xs text-white/40">All positions healthy</div>
                )}

                <span className="text-[10px] text-white/30 group-hover/tile:text-rose-400 transition-colors mt-2 inline-block">
                  {liquidatableCount > 0 ? "Execute now →" : "View positions →"}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 2: ACTIVITY SUMMARY - Two tiles
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Quick Actions</span>
          </div>
          <button
            onClick={() => onSelectTab("history")}
            className="text-[10px] text-white/40 hover:text-emerald-400 transition-colors"
          >
            View History →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* At-Risk Breakdown */}
          <button
            onClick={() => onSelectTab("positions")}
            className="text-left group p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-teal-500/40 hover:bg-teal-500/5 transition-all flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">At-Risk Positions</span>
              <div className={`badge text-[9px] ${atRiskCount > 0 ? "badge-warning" : "badge-success"}`}>
                {atRiskCount > 0 ? `${atRiskCount} at risk` : "None"}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <span className="text-lg font-semibold text-amber-400 font-mono">{atRiskCount}</span>
                <span className="text-[10px] text-white/30 ml-1">within 20% of liquidation</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              {/* Risk level indicators */}
              <div className="flex-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[10px] text-white/40">{liquidatableCount} liq</span>
              </div>
              <div className="flex-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] text-white/40">{Math.max(0, atRiskCount - liquidatableCount)} critical</span>
              </div>
              <div className="flex-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-white/40">{Math.max(0, positions.length - atRiskCount)} healthy</span>
              </div>
            </div>

            <span className="text-[10px] text-white/30 group-hover:text-teal-400 transition-colors mt-auto pt-2 inline-block">
              View breakdown →
            </span>
          </button>

          {/* Leaderboard Preview */}
          <button
            onClick={() => onSelectTab("leaderboard")}
            className="text-left group p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/40 hover:bg-purple-500/5 transition-all flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Liquidator Leaderboard</span>
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm6.5 14.5v-4h1v4h-1zm-3-2v-2h1v2h-1zm6 1v-3h1v3h-1z" />
              </svg>
            </div>

            <div className="text-lg font-semibold text-white">
              Top Liquidators
            </div>
            <p className="text-xs text-white/40 mt-1">
              See who's earning the most from liquidations
            </p>

            <span className="text-[10px] text-white/30 group-hover:text-purple-400 transition-colors mt-auto pt-2 inline-block">
              View rankings →
            </span>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* ═══════════════════════════════════════════════════════════════════
          QUICK LINKS: Tabs for additional exploration
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 pt-2">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Explore:</span>
        <button
          onClick={() => onSelectTab("positions")}
          className={`px-3 py-1.5 text-[11px] font-medium border rounded-lg transition-all ${
            liquidatableCount > 0
              ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400"
              : "bg-white/[0.03] hover:bg-teal-500/10 border-white/[0.06] hover:border-teal-500/30 text-white/50 hover:text-teal-400"
          }`}
        >
          {liquidatableCount > 0 ? `🔥 ${liquidatableCount} Liquidatable` : "Positions"}
        </button>
        <button
          onClick={() => onSelectTab("analytics")}
          className="px-3 py-1.5 text-[11px] font-medium bg-white/[0.03] hover:bg-amber-500/10 border border-white/[0.06] hover:border-amber-500/30 rounded-lg text-white/50 hover:text-amber-400 transition-all"
        >
          Risk Analytics
        </button>
        <button
          onClick={() => onSelectTab("history")}
          className="px-3 py-1.5 text-[11px] font-medium bg-white/[0.03] hover:bg-blue-500/10 border border-white/[0.06] hover:border-blue-500/30 rounded-lg text-white/50 hover:text-blue-400 transition-all"
        >
          History
        </button>
        <button
          onClick={() => onSelectTab("leaderboard")}
          className="px-3 py-1.5 text-[11px] font-medium bg-white/[0.03] hover:bg-purple-500/10 border border-white/[0.06] hover:border-purple-500/30 rounded-lg text-white/50 hover:text-purple-400 transition-all"
        >
          Leaderboard
        </button>
      </div>

    </div>
  );
}
