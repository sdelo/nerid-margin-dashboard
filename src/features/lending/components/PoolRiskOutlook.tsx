import React from "react";
import {
  useAtRiskPositions,
  type AtRiskPosition,
} from "../../../hooks/useAtRiskPositions";
import { ChartIcon, AlertIcon } from "../../../components/ThemedIcons";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import type { PoolOverview } from "../types";

interface PoolRiskOutlookProps {
  pool: PoolOverview;
  onSelectTab?: (tab: string) => void;
}

interface SimulatedPosition {
  marginManagerId: string;
  originalHF: number;
  simulatedHF: number;
  isLiquidatable: boolean;
  debtUsd: number;
  liquidationThreshold: number;
}

interface SimulationResult {
  priceChange: number;
  liquidatableCount: number;
  totalDebtAtRiskUsd: number;
  worstHF: number | null;
  positions: SimulatedPosition[];
}

/**
 * Calculate collateral and debt values from position
 */
function getPositionValues(position: AtRiskPosition) {
  const collateralUsd = position.baseAssetUsd + position.quoteAssetUsd;
  const debtUsd = position.baseDebtUsd + position.quoteDebtUsd;
  return { collateralUsd, debtUsd };
}

/**
 * Simulate what happens to positions if prices change
 * Returns TOTAL counts/values at that price level (not deltas)
 * Also tracks individual position HFs for transparency
 */
function simulatePositionsWithPriceChange(
  positions: AtRiskPosition[],
  basePriceChangePct: number
): SimulationResult {
  let liquidatableCount = 0;
  let totalDebtAtRiskUsd = 0;
  let worstHF: number | null = null;
  const simulatedPositions: SimulatedPosition[] = [];

  positions.forEach((position) => {
    const basePriceMultiplier = 1 + basePriceChangePct / 100;

    // Recalculate values with new price
    const newBaseAssetUsd = position.baseAssetUsd * basePriceMultiplier;
    const newQuoteAssetUsd = position.quoteAssetUsd;
    const newBaseDebtUsd = position.baseDebtUsd * basePriceMultiplier;
    const newQuoteDebtUsd = position.quoteDebtUsd;

    const newCollateralUsd = newBaseAssetUsd + newQuoteAssetUsd;
    const newDebtUsd = newBaseDebtUsd + newQuoteDebtUsd;

    const newRiskRatio = newDebtUsd > 0 ? newCollateralUsd / newDebtUsd : 999;
    const isNowLiquidatable = newRiskRatio <= position.liquidationThreshold;

    // Track worst HF across all positions
    if (newDebtUsd > 0) {
      if (worstHF === null || newRiskRatio < worstHF) {
        worstHF = newRiskRatio;
      }
    }

    simulatedPositions.push({
      marginManagerId: position.marginManagerId,
      originalHF: position.riskRatio,
      simulatedHF: newRiskRatio,
      isLiquidatable: isNowLiquidatable,
      debtUsd: newDebtUsd,
      liquidationThreshold: position.liquidationThreshold,
    });

    if (isNowLiquidatable) {
      liquidatableCount++;
      totalDebtAtRiskUsd += newDebtUsd;
    }
  });

  return {
    priceChange: basePriceChangePct,
    liquidatableCount,
    totalDebtAtRiskUsd,
    worstHF,
    positions: simulatedPositions,
  };
}

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  if (value < 1 && value > 0) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(0)}`;
}

/**
 * Get proper HF distribution buckets that align with liquidation threshold
 */
function getRiskDistribution(
  positions: AtRiskPosition[],
  liquidationThreshold: number
): Array<{
  label: string;
  minRatio: number;
  maxRatio: number;
  count: number;
  totalDebtUsd: number;
  color: string;
  isLiquidatable: boolean;
}> {
  // Create buckets relative to the actual liquidation threshold
  const buckets = [
    {
      label: `< ${liquidationThreshold.toFixed(2)}`,
      minRatio: 0,
      maxRatio: liquidationThreshold,
      count: 0,
      totalDebtUsd: 0,
      color: "#f43f5e", // Rose-500 - Liquidatable
      isLiquidatable: true,
    },
    {
      label: `${liquidationThreshold.toFixed(2)}–${(liquidationThreshold * 1.05).toFixed(2)}`,
      minRatio: liquidationThreshold,
      maxRatio: liquidationThreshold * 1.05,
      count: 0,
      totalDebtUsd: 0,
      color: "#fb923c", // Orange-400 - Critical
      isLiquidatable: false,
    },
    {
      label: `${(liquidationThreshold * 1.05).toFixed(2)}–${(liquidationThreshold * 1.15).toFixed(2)}`,
      minRatio: liquidationThreshold * 1.05,
      maxRatio: liquidationThreshold * 1.15,
      count: 0,
      totalDebtUsd: 0,
      color: "#fbbf24", // Amber-400 - Warning
      isLiquidatable: false,
    },
    {
      label: `${(liquidationThreshold * 1.15).toFixed(2)}–${(liquidationThreshold * 1.4).toFixed(2)}`,
      minRatio: liquidationThreshold * 1.15,
      maxRatio: liquidationThreshold * 1.4,
      count: 0,
      totalDebtUsd: 0,
      color: "#2dd4bf", // Teal-400 - Safe
      isLiquidatable: false,
    },
    {
      label: `${(liquidationThreshold * 1.4).toFixed(2)}+`,
      minRatio: liquidationThreshold * 1.4,
      maxRatio: Infinity,
      count: 0,
      totalDebtUsd: 0,
      color: "#22d3ee", // Cyan-400 - Very Safe
      isLiquidatable: false,
    },
  ];

  positions.forEach((position) => {
    const bucket = buckets.find(
      (b) => position.riskRatio >= b.minRatio && position.riskRatio < b.maxRatio
    );
    if (bucket) {
      bucket.count++;
      bucket.totalDebtUsd += position.totalDebtUsd;
    }
  });

  return buckets;
}

/**
 * Determine pool health verdict
 */
function getPoolVerdict(
  liquidatableCount: number,
  liquidatableDebtUsd: number,
  distanceToFirstLiq: number | null,
  totalPositions: number
): {
  verdict: "robust" | "watch" | "fragile";
  label: string;
  reason: string;
} {
  if (liquidatableCount > 0) {
    return {
      verdict: "fragile",
      label: "Fragile",
      reason: `${liquidatableCount} position${liquidatableCount > 1 ? "s" : ""} can be liquidated now (${formatUsd(liquidatableDebtUsd)} debt)`,
    };
  }

  if (totalPositions === 0) {
    return {
      verdict: "robust",
      label: "Robust",
      reason: "No open positions - zero counterparty risk",
    };
  }

  if (distanceToFirstLiq !== null && Math.abs(distanceToFirstLiq) < 5) {
    return {
      verdict: "fragile",
      label: "Fragile",
      reason: `First liquidation at just ${Math.abs(distanceToFirstLiq).toFixed(1)}% price move`,
    };
  }

  if (distanceToFirstLiq !== null && Math.abs(distanceToFirstLiq) < 15) {
    return {
      verdict: "watch",
      label: "Watch",
      reason: `First liquidation at ${Math.abs(distanceToFirstLiq).toFixed(1)}% price move`,
    };
  }

  return {
    verdict: "robust",
    label: "Robust",
    reason: "All positions well-collateralized",
  };
}

/**
 * Calculate distance to first liquidation
 */
function calculateDistanceToFirstLiquidation(
  positions: AtRiskPosition[]
): { priceDrop: number | null; priceIncrease: number | null } {
  let closestDropPct: number | null = null;
  let closestIncreasePct: number | null = null;

  positions.forEach((position) => {
    if (position.isLiquidatable) return;

    const { collateralUsd, debtUsd } = getPositionValues(position);
    if (debtUsd === 0) return;

    const netBaseExposure = position.baseAssetUsd - position.baseDebtUsd;

    if (Math.abs(netBaseExposure) > 0.01) {
      const targetCollateral = position.liquidationThreshold * debtUsd;
      const changeNeeded = (targetCollateral - collateralUsd) / netBaseExposure;
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
 * Redesigned Price Shock Simulator Component
 * Clear, intuitive interface for understanding liquidation risk under price changes
 */
interface PriceShockSimulatorProps {
  pool: PoolOverview;
  poolPositions: AtRiskPosition[];
  currentState: { liquidatableCount: number; totalDebtAtRiskUsd: number };
  distanceToLiquidation: { priceDrop: number | null; priceIncrease: number | null };
  priceChangePct: number;
  setPriceChangePct: (pct: number) => void;
  simulatedState: SimulationResult;
  scenarios: SimulationResult[];
}

function PriceShockSimulator({
  pool,
  poolPositions,
  currentState,
  distanceToLiquidation,
  priceChangePct,
  setPriceChangePct,
  simulatedState,
  scenarios,
}: PriceShockSimulatorProps) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  
  // Calculate current base price from first position
  const currentBasePrice = poolPositions[0]?.basePythPrice 
    ? poolPositions[0].basePythPrice / Math.pow(10, Math.abs(poolPositions[0].basePythDecimals || 0))
    : 0;
  
  const simulatedPrice = currentBasePrice * (1 + priceChangePct / 100);
  const liquidatableDelta = simulatedState.liquidatableCount - currentState.liquidatableCount;
  
  // Find first liquidation threshold (the killer metric)
  const firstLiquidationAt = distanceToLiquidation.priceDrop !== null 
    ? Math.abs(distanceToLiquidation.priceDrop)
    : null;
  
  // Chart calculations
  const maxLiquidatable = Math.max(...scenarios.map((s) => s.liquidatableCount), 1);
  
  // Presets for quick selection
  const presets = [-30, -20, -10, -5, 0, 5, 10];
  
  // Find indices
  const currentIdx = scenarios.findIndex(s => s.priceChange === 0);
  const selectedIdx = scenarios.findIndex(s => s.priceChange === priceChangePct);

  // Get liquidation threshold from positions
  const liquidationThreshold = poolPositions[0]?.liquidationThreshold ?? 1.10;
  
  // Get liquidatable positions at current simulation for the proof list
  const liquidatableAtShock = simulatedState.positions
    .filter(p => p.isLiquidatable)
    .sort((a, b) => a.simulatedHF - b.simulatedHF);

  return (
    <div className="bg-slate-800/50 border border-amber-400/10 rounded-xl p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 rounded-lg">
              <AlertIcon size={16} variant="warning" />
            </div>
            Price Shock Simulator
          </h3>
          <p className="text-[11px] text-white/50 mt-0.5 ml-8">
            What happens if {pool.asset} moves?
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: SLIDER + SHOCK PILLS
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-black/20 rounded-lg p-3 mb-3 border border-white/5">
        {/* Price display inline with slider */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-white/50">{pool.asset}</span>
            <span className="font-mono text-white/70">${currentBasePrice.toFixed(4)}</span>
            <span className="text-white/30">→</span>
            <span className={`font-mono font-semibold ${
              priceChangePct < 0 ? "text-rose-400" : priceChangePct > 0 ? "text-emerald-400" : "text-white"
            }`}>
              ${simulatedPrice.toFixed(4)}
            </span>
          </div>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            priceChangePct < 0 
              ? "bg-rose-500/20 text-rose-300" 
              : priceChangePct > 0 
                ? "bg-emerald-500/20 text-emerald-300" 
                : "bg-white/10 text-white/60"
          }`}>
            {priceChangePct > 0 ? "+" : ""}{priceChangePct}%
          </span>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={-30}
          max={20}
          step={1}
          value={priceChangePct}
          onChange={(e) => setPriceChangePct(Number(e.target.value))}
          className="w-full h-1.5 bg-gradient-to-r from-rose-500/40 via-slate-600/40 to-emerald-500/40 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 
            [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-400/50
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20
            [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
        />
        <div className="flex justify-between text-[9px] text-white/40 mt-0.5 mb-2">
          <span className="text-rose-400/60">−30%</span>
          <span>0%</span>
          <span className="text-emerald-400/60">+20%</span>
        </div>
        
        {/* Preset Chips */}
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => setPriceChangePct(preset)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                priceChangePct === preset
                  ? "bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/30"
                  : preset < 0
                    ? "bg-rose-500/10 text-rose-300/70 hover:bg-rose-500/20 border border-rose-500/20"
                    : preset > 0
                      ? "bg-emerald-500/10 text-emerald-300/70 hover:bg-emerald-500/20 border border-emerald-500/20"
                      : "bg-white/5 text-white/50 hover:bg-white/10 border border-white/10"
              }`}
            >
              {preset > 0 ? "+" : ""}{preset}%
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: TWO KPI CARDS (with shock level in label + worst HF proof)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Liquidatable at X% */}
        <div className={`rounded-lg p-3 border transition-colors ${
          simulatedState.liquidatableCount > 0 
            ? "bg-rose-500/10 border-rose-500/30" 
            : "bg-black/20 border-white/5"
        }`}>
          <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">
            Liquidatable at <span className={priceChangePct !== 0 ? (priceChangePct < 0 ? "text-rose-300" : "text-emerald-300") : "text-white/70"}>
              {priceChangePct > 0 ? "+" : ""}{priceChangePct}%
            </span>
          </div>
          <div className={`text-2xl font-bold tabular-nums ${
            simulatedState.liquidatableCount > 0 ? "text-rose-400" : "text-emerald-400"
          }`}>
            {simulatedState.liquidatableCount}
          </div>
          {liquidatableDelta !== 0 ? (
            <div className={`text-[10px] ${liquidatableDelta > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {liquidatableDelta > 0 ? "+" : ""}{liquidatableDelta} from current
            </div>
          ) : (
            <div className="text-[10px] text-white/30">
              {priceChangePct === 0 ? "current state" : "no change"}
            </div>
          )}
          {/* Worst HF proof line */}
          {simulatedState.worstHF !== null && (
            <div className={`text-[9px] mt-1 pt-1 border-t border-white/10 font-mono ${
              simulatedState.worstHF < liquidationThreshold ? "text-rose-300" : "text-white/40"
            }`}>
              Worst HF: {simulatedState.worstHF.toFixed(3)} 
              <span className="text-white/30"> (liq @ {liquidationThreshold.toFixed(2)})</span>
            </div>
          )}
        </div>

        {/* Debt at Risk at X% */}
        <div className={`rounded-lg p-3 border transition-colors ${
          simulatedState.totalDebtAtRiskUsd > 0 
            ? "bg-amber-500/10 border-amber-500/30" 
            : "bg-black/20 border-white/5"
        }`}>
          <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">
            Debt at Risk at <span className={priceChangePct !== 0 ? (priceChangePct < 0 ? "text-rose-300" : "text-emerald-300") : "text-white/70"}>
              {priceChangePct > 0 ? "+" : ""}{priceChangePct}%
            </span>
          </div>
          <div className={`text-2xl font-bold tabular-nums ${
            simulatedState.totalDebtAtRiskUsd > 0 ? "text-amber-400" : "text-white/50"
          }`}>
            {formatUsd(simulatedState.totalDebtAtRiskUsd)}
          </div>
          <div className="text-[10px] text-white/30">
            {simulatedState.liquidatableCount > 0 
              ? `sum of ${simulatedState.liquidatableCount} position${simulatedState.liquidatableCount > 1 ? 's' : ''} debt` 
              : "no positions at risk"}
          </div>
        </div>
      </div>

      {/* First Liquidation Threshold Alert */}
      {currentState.liquidatableCount === 0 && firstLiquidationAt !== null && firstLiquidationAt > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-transparent rounded-lg px-3 py-2 mb-3 border-l-2 border-amber-400">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-amber-300/90">⚡ First liquidation at</span>
            <span className="font-bold text-amber-400">−{firstLiquidationAt.toFixed(1)}%</span>
            <span className="text-white/40 text-[10px]">
              (${(currentBasePrice * (1 - firstLiquidationAt / 100)).toFixed(4)})
            </span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: LIQUIDATABLE POSITIONS BY SHOCK CHART
          Bar chart showing position count that would be liquidatable at each shock
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-black/20 rounded-lg p-3 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-white/50 uppercase tracking-wide">
            Liquidatable Positions by Shock
          </div>
          <div className="text-[9px] text-white/30">
            {poolPositions.length} total position{poolPositions.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        {/* Bar chart with count labels */}
        <div className="flex items-end gap-0.5 h-20">
          {scenarios.map((s, i) => {
            const heightPct = maxLiquidatable > 0 ? (s.liquidatableCount / maxLiquidatable) * 100 : 0;
            const isSelected = s.priceChange === priceChangePct;
            const isCurrent = s.priceChange === 0;
            const isNegative = s.priceChange < 0;
            const showCount = s.liquidatableCount > 0 || isSelected;
            
            return (
              <button
                key={i}
                onClick={() => setPriceChangePct(s.priceChange)}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex-1 relative transition-all rounded-t group flex flex-col items-center ${
                  isSelected 
                    ? "ring-2 ring-cyan-400 ring-offset-1 ring-offset-black/50 z-10" 
                    : "hover:opacity-80"
                }`}
                style={{ 
                  height: `${Math.max(heightPct, 8)}%`,
                  minHeight: 8,
                }}
              >
                {/* Count label on bar */}
                {showCount && (
                  <span className={`absolute -top-3.5 text-[8px] font-bold ${
                    isSelected ? "text-cyan-300" : s.liquidatableCount > 0 ? "text-rose-300" : "text-white/30"
                  }`}>
                    {s.liquidatableCount}
                  </span>
                )}
                
                {/* Bar fill */}
                <div 
                  className={`absolute inset-0 rounded-t transition-colors ${
                    isSelected
                      ? "bg-cyan-400 shadow-lg shadow-cyan-400/30"
                      : isCurrent
                        ? "bg-white/40"
                        : isNegative
                          ? s.liquidatableCount > 0 ? "bg-rose-500" : "bg-rose-500/20"
                          : s.liquidatableCount > 0 ? "bg-emerald-500" : "bg-emerald-500/20"
                  }`}
                />
                
                {/* Enhanced hover tooltip with HF info */}
                {hoveredIdx === i && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-5 px-2 py-1.5 bg-slate-900 border border-white/20 rounded text-[9px] whitespace-nowrap z-20 shadow-xl">
                    <div className="font-semibold text-white mb-0.5">
                      At {s.priceChange > 0 ? "+" : ""}{s.priceChange}%
                    </div>
                    <div className={s.liquidatableCount > 0 ? "text-rose-400" : "text-emerald-400"}>
                      {s.liquidatableCount}/{poolPositions.length} liquidatable
                    </div>
                    {s.worstHF !== null && (
                      <div className="text-white/50 mt-0.5">
                        Worst HF: {s.worstHF.toFixed(3)}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        
        {/* X-axis labels */}
        <div className="flex justify-between mt-1 text-[9px]">
          <span className="text-rose-400/60">{scenarios[0]?.priceChange}%</span>
          {currentIdx !== -1 && (
            <span className="text-white/50">0%</span>
          )}
          <span className="text-emerald-400/60">+{scenarios[scenarios.length - 1]?.priceChange}%</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: LIQUIDATABLE POSITIONS LIST (PROOF)
          Shows exactly which positions would be liquidated with their HF
      ═══════════════════════════════════════════════════════════════════════ */}
      {liquidatableAtShock.length > 0 && (
        <div className="mt-3 bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
          <div className="text-[10px] text-rose-300/80 uppercase tracking-wide mb-2 flex items-center justify-between">
            <span>
              Liquidatable positions at {priceChangePct > 0 ? "+" : ""}{priceChangePct}% ({liquidatableAtShock.length})
            </span>
            <span className="text-rose-400/60 normal-case">
              threshold: {liquidationThreshold.toFixed(2)}
            </span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {liquidatableAtShock.slice(0, 5).map((pos) => (
              <div 
                key={pos.marginManagerId}
                className="flex items-center justify-between text-[10px] bg-black/20 rounded px-2 py-1.5"
              >
                <code className="text-white/60 font-mono">
                  {pos.marginManagerId.slice(0, 10)}…{pos.marginManagerId.slice(-4)}
                </code>
                <div className="flex items-center gap-3">
                  <span className="text-white/40">
                    HF: <span className="text-white/60">{pos.originalHF.toFixed(3)}</span>
                    <span className="text-white/30 mx-1">→</span>
                    <span className="text-rose-400 font-semibold">{pos.simulatedHF.toFixed(3)}</span>
                  </span>
                  <span className="text-amber-400/80">
                    {formatUsd(pos.debtUsd)}
                  </span>
                </div>
              </div>
            ))}
            {liquidatableAtShock.length > 5 && (
              <div className="text-[9px] text-white/30 text-center pt-1">
                +{liquidatableAtShock.length - 5} more positions
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pool-specific forward-looking risk outlook
 */
export function PoolRiskOutlook({ pool, onSelectTab }: PoolRiskOutlookProps) {
  const [priceChangePct, setPriceChangePct] = React.useState(0);

  const baseMarginPoolId = pool.contracts?.marginPoolId;

  const {
    positions: allPositions,
    isLoading,
    error,
  } = useAtRiskPositions();

  // Filter positions for this pool
  const poolPositions = React.useMemo(() => {
    if (!baseMarginPoolId) return allPositions;
    return allPositions.filter(
      (p) =>
        p.baseMarginPoolId === baseMarginPoolId ||
        p.quoteMarginPoolId === baseMarginPoolId
    );
  }, [allPositions, baseMarginPoolId]);

  // Get actual liquidation threshold from positions (or default)
  const liquidationThreshold = poolPositions[0]?.liquidationThreshold ?? 1.05;

  // Calculate current state from actual position data (not simulation)
  const currentState = React.useMemo(() => {
    const liquidatable = poolPositions.filter((p) => p.isLiquidatable);
    return {
      liquidatableCount: liquidatable.length,
      totalDebtAtRiskUsd: liquidatable.reduce((sum, p) => sum + p.totalDebtUsd, 0),
    };
  }, [poolPositions]);

  // Risk distribution using actual threshold
  const riskDistribution = React.useMemo(
    () => getRiskDistribution(poolPositions, liquidationThreshold),
    [poolPositions, liquidationThreshold]
  );

  // Calculate distance to first liquidation
  const distanceToLiquidation = React.useMemo(
    () => calculateDistanceToFirstLiquidation(poolPositions),
    [poolPositions]
  );

  // Simulated state at selected price change
  const simulatedState = React.useMemo(
    () => simulatePositionsWithPriceChange(poolPositions, priceChangePct),
    [poolPositions, priceChangePct]
  );

  // All scenarios for the chart (extended range for slider)
  const scenarios = React.useMemo(() => {
    const changes = [-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20];
    return changes.map((change) =>
      simulatePositionsWithPriceChange(poolPositions, change)
    );
  }, [poolPositions]);

  const totalPositions = poolPositions.length;

  // Get verdict
  const closestMove =
    distanceToLiquidation.priceDrop !== null
      ? distanceToLiquidation.priceDrop
      : distanceToLiquidation.priceIncrease;

  const verdict = React.useMemo(
    () =>
      getPoolVerdict(
        currentState.liquidatableCount,
        currentState.totalDebtAtRiskUsd,
        closestMove,
        totalPositions
      ),
    [currentState, closestMove, totalPositions]
  );

  // Get top liquidatable positions for quick view
  const topLiquidatable = React.useMemo(
    () =>
      poolPositions
        .filter((p) => p.isLiquidatable)
        .sort((a, b) => b.totalDebtUsd - a.totalDebtUsd)
        .slice(0, 3),
    [poolPositions]
  );

  if (isLoading && poolPositions.length === 0) {
    return (
      <div className="space-y-3">
        <div className="bg-white/5 rounded-lg border border-white/10 p-3 animate-pulse">
          <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
          <div className="h-16 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-center">
        <p className="text-rose-400 text-xs">
          Error loading risk data: {error.message}
        </p>
      </div>
    );
  }

  // Calculate change from current state
  const liquidatableDelta = simulatedState.liquidatableCount - currentState.liquidatableCount;

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════════════════
          RISK SUMMARY STRIP
      ═══════════════════════════════════════════════════════════════════════ */}
      <div
        className={`rounded-xl px-4 py-3 backdrop-blur-sm ${
          verdict.verdict === "robust"
            ? "bg-emerald-500/10 border border-emerald-500/20"
            : verdict.verdict === "watch"
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-rose-500/10 border border-rose-500/20"
        }`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Status + Reason */}
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
            <span className="text-sm text-white/80">{verdict.reason}</span>
          </div>

          {/* Right: CTA */}
          {currentState.liquidatableCount > 0 && onSelectTab && (
            <button
              onClick={() => onSelectTab("liquidations")}
              className="px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg border border-cyan-400/30 transition-all"
            >
              View positions →
            </button>
          )}
        </div>

        {/* Key metrics row */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-white/10 text-xs">
          <div>
            <span className="text-white/50">Positions</span>
            <span className="ml-2 font-semibold text-white">{totalPositions}</span>
          </div>
          <div>
            <span className="text-white/50">Liquidatable</span>
            <span
              className={`ml-2 font-semibold ${currentState.liquidatableCount > 0 ? "text-rose-400" : "text-emerald-400"}`}
            >
              {currentState.liquidatableCount}
            </span>
          </div>
          <div>
            <span className="text-white/50">Debt at risk</span>
            <span
              className={`ml-2 font-semibold ${currentState.totalDebtAtRiskUsd > 0 ? "text-rose-400" : "text-white"}`}
            >
              {formatUsd(currentState.totalDebtAtRiskUsd)}
            </span>
          </div>
          {distanceToLiquidation.priceDrop !== null && currentState.liquidatableCount === 0 && (
            <div>
              <span className="text-white/50">First liq at</span>
              <span className="ml-2 font-semibold text-amber-400">
                {Math.abs(distanceToLiquidation.priceDrop).toFixed(1)}% drop
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          LIQUIDATABLE POSITIONS QUICK VIEW (if any)
      ═══════════════════════════════════════════════════════════════════════ */}
      {topLiquidatable.length > 0 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Liquidatable Now
          </h3>
          <div className="space-y-2">
            {topLiquidatable.map((pos) => (
              <div
                key={pos.marginManagerId}
                className="flex items-center justify-between text-xs bg-black/20 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <code className="text-white/60 font-mono">
                    {pos.marginManagerId.slice(0, 8)}…
                  </code>
                  <span className="text-rose-400">
                    HF {pos.riskRatio.toFixed(3)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white/70">
                    Debt: <span className="text-white font-medium">{formatUsd(pos.totalDebtUsd)}</span>
                  </span>
                  <span className="text-emerald-400">
                    Reward: ~{formatUsd(pos.estimatedRewardUsd)}
                  </span>
                </div>
              </div>
            ))}
            {currentState.liquidatableCount > 3 && (
              <p className="text-xs text-white/40 text-center pt-1">
                +{currentState.liquidatableCount - 3} more positions
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TWO-COLUMN GRID
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: HEALTH FACTOR DISTRIBUTION */}
        <div className="bg-slate-800/50 border border-cyan-400/10 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                <ChartIcon size={16} className="text-cyan-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Health Factor Distribution
              </h3>
              <div className="relative group">
                <QuestionMarkCircleIcon className="w-4 h-4 text-white/40 hover:text-white/60 cursor-help" />
                <div className="absolute left-0 bottom-full mb-1 w-56 p-2 bg-slate-900 border border-cyan-400/20 rounded-lg text-[11px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                  Health Factor = Collateral / Debt. Below {liquidationThreshold.toFixed(2)} = liquidatable.
                </div>
              </div>
            </div>
            <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded">
              Threshold: {liquidationThreshold.toFixed(2)}
            </span>
          </div>

          {totalPositions === 0 ? (
            <div className="text-center py-6 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <div className="text-emerald-400 text-sm font-semibold">
                ✓ No Active Borrowers
              </div>
              <p className="text-xs text-white/50 mt-1">No counterparty risk</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {riskDistribution.map((bucket, idx) => {
                const maxBucketCount = Math.max(
                  ...riskDistribution.map((b) => b.count),
                  1
                );
                const widthPct = bucket.count > 0 ? (bucket.count / maxBucketCount) * 100 : 0;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-xs ${bucket.count === 0 ? "opacity-40" : ""}`}
                  >
                    <span
                      className={`w-20 text-right font-mono ${bucket.isLiquidatable ? "text-rose-400 font-semibold" : "text-white/50"}`}
                    >
                      {bucket.label}
                    </span>
                    <div className="flex-1 h-2.5 bg-black/30 rounded-full overflow-hidden">
                      {bucket.count > 0 && (
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(widthPct, 4)}%`,
                            backgroundColor: bucket.color,
                            boxShadow: `0 0 8px ${bucket.color}40`,
                          }}
                        />
                      )}
                    </div>
                    <span
                      className={`w-8 text-right font-semibold ${bucket.isLiquidatable && bucket.count > 0 ? "text-rose-400" : "text-white/70"}`}
                    >
                      {bucket.count}
                    </span>
                    {bucket.count > 0 && (
                      <span className="w-16 text-right text-white/40">
                        {formatUsd(bucket.totalDebtUsd)}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* Legend */}
              <div className="flex items-center gap-4 pt-2 mt-2 border-t border-white/5 text-[10px] text-white/40">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Liquidatable
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> At risk
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> Safe
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: PRICE SHOCK SIMULATOR */}
        {totalPositions > 0 ? (
          <PriceShockSimulator
            pool={pool}
            poolPositions={poolPositions}
            currentState={currentState}
            distanceToLiquidation={distanceToLiquidation}
            priceChangePct={priceChangePct}
            setPriceChangePct={setPriceChangePct}
            simulatedState={simulatedState}
            scenarios={scenarios}
          />
        ) : (
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center py-6">
              <div className="p-2 bg-white/5 rounded-lg inline-block mb-2">
                <AlertIcon size={20} variant="warning" />
              </div>
              <div className="text-sm text-white/50 font-medium">
                Price Shock Simulator
              </div>
              <p className="text-xs text-white/30 mt-1">
                Available when positions exist
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SUMMARY - Context-aware, not boilerplate
      ═══════════════════════════════════════════════════════════════════════ */}
      {totalPositions > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
            Risk Assessment
          </h4>
          <div className="text-sm text-white/70">
            {currentState.liquidatableCount > 0 ? (
              <p>
                <span className="text-rose-400 font-semibold">Immediate action needed:</span>{" "}
                {currentState.liquidatableCount} position{currentState.liquidatableCount > 1 ? "s" : ""}{" "}
                with {formatUsd(currentState.totalDebtAtRiskUsd)} debt can be liquidated now.
                Suppliers face bad debt risk if liquidations fail.
              </p>
            ) : distanceToLiquidation.priceDrop !== null &&
              Math.abs(distanceToLiquidation.priceDrop) < 10 ? (
              <p>
                <span className="text-amber-400 font-semibold">Monitor closely:</span>{" "}
                A {Math.abs(distanceToLiquidation.priceDrop).toFixed(1)}% {pool.asset} drop
                would trigger the first liquidation. Current market volatility may pose risk.
              </p>
            ) : (
              <p>
                <span className="text-emerald-400 font-semibold">Well-collateralized:</span>{" "}
                All positions have healthy collateral ratios.
                {distanceToLiquidation.priceDrop !== null && (
                  <> First liquidation requires a {Math.abs(distanceToLiquidation.priceDrop).toFixed(0)}%+ price move.</>
                )}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
