import React from 'react';
import { useScenario, type ShockAsset, simulateAllPositions } from '../../../context/ScenarioContext';
import { type AtRiskPosition } from '../../../hooks/useAtRiskPositions';

interface ScenarioHeaderProps {
  positions: AtRiskPosition[];
  availableAssets?: ShockAsset[];
}

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Scenario Header with shock asset selector and scenario mode KPIs
 */
export function ScenarioHeader({ positions, availableAssets = ['SUI', 'DEEP'] }: ScenarioHeaderProps) {
  const { 
    isActive, 
    shockAsset, 
    shockPct, 
    range,
    setShockAsset, 
    setShockPct,
    resetScenario 
  } = useScenario();

  // Calculate scenario summary
  const scenarioSummary = React.useMemo(() => {
    if (!isActive || shockPct === 0) return null;
    return simulateAllPositions(positions, shockPct, shockAsset);
  }, [positions, shockPct, shockAsset, isActive]);

  // Calculate current state for comparison
  const currentState = React.useMemo(() => {
    return simulateAllPositions(positions, 0, shockAsset);
  }, [positions, shockAsset]);

  return (
    <div className="space-y-3">
      {/* Shock Asset Selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">Shock Asset:</span>
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
            {availableAssets.map((asset) => (
              <button
                key={asset}
                onClick={() => setShockAsset(asset)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  shockAsset === asset
                    ? 'bg-teal-500 text-slate-900'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>

        {/* Quick shock slider when active */}
        {isActive && (
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="-50"
              max="20"
              value={shockPct}
              onChange={(e) => setShockPct(Number(e.target.value))}
              className="w-32 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-teal-400
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-teal-400
                [&::-moz-range-thumb]:cursor-pointer
                [&::-moz-range-thumb]:border-none"
            />
            <span className={`text-sm font-bold tabular-nums w-12 text-right ${
              shockPct === 0 ? 'text-white' :
              shockPct < 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {shockPct > 0 ? '+' : ''}{shockPct}%
            </span>
          </div>
        )}
      </div>

      {/* Scenario Mode Banner */}
      {isActive && shockPct !== 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Banner label */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-sm font-semibold text-rose-200">
                  Scenario Mode: {shockAsset} {shockPct > 0 ? '+' : ''}{shockPct}%
                </span>
              </div>
              <button
                onClick={resetScenario}
                className="text-xs text-rose-300 hover:text-white underline underline-offset-2"
              >
                Reset to Now
              </button>
            </div>

            {/* Scenario KPIs */}
            {scenarioSummary && (
              <div className="flex items-center gap-4">
                {/* Liquidatable at shock */}
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-white/40">Liquidatable</div>
                  <div className="text-lg font-bold text-rose-400 tabular-nums">
                    {scenarioSummary.liquidatableCount}
                    {scenarioSummary.newLiquidations > 0 && (
                      <span className="text-xs text-rose-300 ml-1">
                        (+{scenarioSummary.newLiquidations})
                      </span>
                    )}
                  </div>
                </div>

                {/* Debt in liquidation zone */}
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-white/40">Debt at Risk</div>
                  <div className="text-lg font-bold text-cyan-400 tabular-nums">
                    {formatUsd(scenarioSummary.debtAtRiskUsd)}
                  </div>
                </div>

                {/* First liquidation */}
                {scenarioSummary.firstLiquidationAt !== null && currentState.liquidatableCount === 0 && (
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wider text-white/40">First Liq At</div>
                    <div className="text-lg font-bold text-amber-400 tabular-nums">
                      {Math.abs(scenarioSummary.firstLiquidationAt).toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Range info */}
          {range && (
            <div className="mt-2 pt-2 border-t border-rose-500/20 text-xs text-rose-200">
              Showing positions that liquidate between {range.min}% and {range.max}% shock
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact Scenario Tiles for the top metrics strip
 */
export function ScenarioMetricTiles({ positions }: { positions: AtRiskPosition[] }) {
  const { isActive, shockAsset, shockPct } = useScenario();

  const scenarioSummary = React.useMemo(() => {
    if (!isActive || shockPct === 0) return null;
    return simulateAllPositions(positions, shockPct, shockAsset);
  }, [positions, shockPct, shockAsset, isActive]);

  const currentState = React.useMemo(() => {
    return simulateAllPositions(positions, 0, shockAsset);
  }, [positions, shockAsset]);

  if (!isActive || shockPct === 0 || !scenarioSummary) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Liquidatable at shock */}
      <div className={`rounded-xl p-3 border ${
        scenarioSummary.liquidatableCount > currentState.liquidatableCount
          ? 'bg-rose-500/10 border-rose-500/30'
          : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1">At {shockPct}% Shock</div>
        <div className="text-xl font-bold text-rose-400 tabular-nums">
          {scenarioSummary.liquidatableCount}
        </div>
        <div className="text-[10px] text-white/40 mt-0.5">
          {scenarioSummary.newLiquidations > 0 
            ? `+${scenarioSummary.newLiquidations} new` 
            : 'liquidatable'}
        </div>
      </div>

      {/* Debt in zone */}
      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
        <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Debt at Risk</div>
        <div className="text-xl font-bold text-cyan-400 tabular-nums">
          {formatUsd(scenarioSummary.debtAtRiskUsd)}
        </div>
        <div className="text-[10px] text-white/40 mt-0.5">at {shockPct}% shock</div>
      </div>

      {/* Collateral at risk */}
      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
        <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Collateral at Risk</div>
        <div className="text-xl font-bold text-amber-400 tabular-nums">
          {formatUsd(scenarioSummary.collateralAtRiskUsd)}
        </div>
        <div className="text-[10px] text-white/40 mt-0.5">at {shockPct}% shock</div>
      </div>
    </div>
  );
}
