import React from 'react';
import { type AtRiskPosition, type RiskDistributionBucket } from '../../../hooks/useAtRiskPositions';
import { StressCurveChart } from './StressCurveChart';

interface LiquidationAnalyticsProps {
  positions: AtRiskPosition[];
  riskDistribution: RiskDistributionBucket[];
  isLoading: boolean;
}

type HistogramMode = 'count' | 'dollar';

/**
 * Simulate positions at a given price change
 */
function simulateAtPriceChange(
  positions: AtRiskPosition[],
  priceChangePct: number
): { liquidatableCount: number; debtAtRiskUsd: number; collateralAtRiskUsd: number } {
  let liquidatableCount = 0;
  let debtAtRiskUsd = 0;
  let collateralAtRiskUsd = 0;

  positions.forEach((position) => {
    const basePriceMultiplier = 1 + priceChangePct / 100;
    
    const newBaseAssetUsd = position.baseAssetUsd * basePriceMultiplier;
    const newQuoteAssetUsd = position.quoteAssetUsd;
    const newBaseDebtUsd = position.baseDebtUsd * basePriceMultiplier;
    const newQuoteDebtUsd = position.quoteDebtUsd;

    const newCollateralValueUsd = newBaseAssetUsd + newQuoteAssetUsd;
    const newDebtValueUsd = newBaseDebtUsd + newQuoteDebtUsd;

    const newRiskRatio = newDebtValueUsd > 0 ? newCollateralValueUsd / newDebtValueUsd : 999;
    const isLiquidatable = newRiskRatio <= position.liquidationThreshold;

    if (isLiquidatable) {
      liquidatableCount++;
      debtAtRiskUsd += newDebtValueUsd;
      collateralAtRiskUsd += newCollateralValueUsd;
    }
  });

  return { liquidatableCount, debtAtRiskUsd, collateralAtRiskUsd };
}

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Risk Distribution Histogram Component
 */
function RiskDistributionHistogram({
  riskDistribution,
  histogramMode,
  onModeChange,
  totalPositions,
}: {
  riskDistribution: RiskDistributionBucket[];
  histogramMode: HistogramMode;
  onModeChange: (mode: HistogramMode) => void;
  totalPositions: number;
}) {
  const maxCount = Math.max(...riskDistribution.map(b => b.count), 1);
  const maxDebt = Math.max(...riskDistribution.map(b => b.totalDebtUsd), 1);

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Risk Band Distribution
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            {totalPositions} total positions · Grouped by health factor
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Count ↔ $ Toggle */}
          <div className="flex bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => onModeChange('count')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                histogramMode === 'count' 
                  ? 'bg-teal-500 text-slate-900' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Count
            </button>
            <button
              onClick={() => onModeChange('dollar')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                histogramMode === 'dollar' 
                  ? 'bg-teal-500 text-slate-900' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              $ Debt
            </button>
          </div>
        </div>
      </div>

      {/* Histogram Bars */}
      <div className="flex items-end gap-2 h-40">
        {riskDistribution.map((bucket, idx) => {
          const value = histogramMode === 'count' ? bucket.count : bucket.totalDebtUsd;
          const maxValue = histogramMode === 'count' ? maxCount : maxDebt;
          const heightPct = value > 0 ? Math.max((value / maxValue) * 100, 8) : 4;
          
          return (
            <div
              key={idx}
              className="flex-1 group relative h-full flex flex-col justify-end"
              title={`${bucket.count} positions · ${formatUsd(bucket.totalDebtUsd)} · ${bucket.label}`}
            >
              {/* Bar */}
              <div
                className="w-full rounded-t transition-all group-hover:brightness-125"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: bucket.color,
                  minHeight: value > 0 ? '8px' : '4px',
                }}
              />
              
              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-[10px] whitespace-nowrap shadow-xl">
                  <div className="font-semibold text-white">{bucket.count} positions</div>
                  <div className="text-teal-400">{formatUsd(bucket.totalDebtUsd)} debt</div>
                  <div className="text-white/60 mt-1">{bucket.label}</div>
                </div>
              </div>
              
              {/* Count label on bar */}
              {value > 0 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white drop-shadow-lg">
                  {histogramMode === 'count' ? bucket.count : formatUsd(bucket.totalDebtUsd)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* X-axis Labels */}
      <div className="flex gap-2 mt-3">
        {riskDistribution.map((bucket, idx) => (
          <div key={idx} className="flex-1 text-center text-[10px] text-white/50 font-mono">
            {bucket.label}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-white/50">Liquidatable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span className="text-white/50">Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
          <span className="text-white/50">Watch</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-white/50">Safe</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Price Sensitivity Simulator - Interactive what-if analysis
 */
function PriceSensitivitySimulator({
  positions,
}: {
  positions: AtRiskPosition[];
}) {
  const [priceChange, setPriceChange] = React.useState(0);
  
  const simulation = React.useMemo(
    () => simulateAtPriceChange(positions, priceChange),
    [positions, priceChange]
  );
  
  const currentState = React.useMemo(
    () => simulateAtPriceChange(positions, 0),
    [positions]
  );

  // Preset scenarios
  const presets = [
    { label: '-30%', value: -30 },
    { label: '-20%', value: -20 },
    { label: '-10%', value: -10 },
    { label: 'Now', value: 0 },
    { label: '+10%', value: 10 },
    { label: '+20%', value: 20 },
  ];

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Price Sensitivity Simulator
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            What if the base asset price changes?
          </p>
        </div>
        
        {/* Presets */}
        <div className="flex gap-1">
          {presets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setPriceChange(preset.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                priceChange === preset.value
                  ? 'bg-teal-500 text-slate-900'
                  : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/15'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/40">Price Change</span>
          <span className={`text-lg font-bold tabular-nums ${
            priceChange === 0 ? 'text-white' :
            priceChange < 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {priceChange > 0 ? '+' : ''}{priceChange}%
          </span>
        </div>
        <input
          type="range"
          min="-50"
          max="50"
          value={priceChange}
          onChange={(e) => setPriceChange(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-teal-400
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-teal-400
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-none"
        />
        <div className="flex justify-between text-[10px] text-white/30 mt-1">
          <span>-50%</span>
          <span>0%</span>
          <span>+50%</span>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-3 gap-4">
        {/* Liquidatable Count */}
        <div className={`p-4 rounded-lg border ${
          simulation.liquidatableCount > currentState.liquidatableCount
            ? 'bg-rose-500/10 border-rose-500/30'
            : simulation.liquidatableCount < currentState.liquidatableCount
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/[0.04] border-white/[0.08]'
        }`}>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Liquidatable</div>
          <div className={`text-2xl font-bold tabular-nums ${
            simulation.liquidatableCount > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {simulation.liquidatableCount}
          </div>
          {simulation.liquidatableCount !== currentState.liquidatableCount && (
            <div className={`text-xs mt-1 ${
              simulation.liquidatableCount > currentState.liquidatableCount ? 'text-rose-300' : 'text-emerald-300'
            }`}>
              {simulation.liquidatableCount > currentState.liquidatableCount ? '+' : ''}
              {simulation.liquidatableCount - currentState.liquidatableCount} vs now
            </div>
          )}
        </div>

        {/* Debt at Risk */}
        <div className={`p-4 rounded-lg border ${
          simulation.debtAtRiskUsd > currentState.debtAtRiskUsd
            ? 'bg-rose-500/10 border-rose-500/30'
            : 'bg-white/[0.04] border-white/[0.08]'
        }`}>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Debt at Risk</div>
          <div className={`text-2xl font-bold tabular-nums ${
            simulation.debtAtRiskUsd > 0 ? 'text-rose-400' : 'text-white/30'
          }`}>
            {formatUsd(simulation.debtAtRiskUsd)}
          </div>
          {simulation.debtAtRiskUsd !== currentState.debtAtRiskUsd && (
            <div className={`text-xs mt-1 ${
              simulation.debtAtRiskUsd > currentState.debtAtRiskUsd ? 'text-rose-300' : 'text-emerald-300'
            }`}>
              {simulation.debtAtRiskUsd > currentState.debtAtRiskUsd ? '+' : ''}
              {formatUsd(simulation.debtAtRiskUsd - currentState.debtAtRiskUsd)}
            </div>
          )}
        </div>

        {/* Collateral at Risk */}
        <div className={`p-4 rounded-lg border ${
          simulation.collateralAtRiskUsd > currentState.collateralAtRiskUsd
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-white/[0.04] border-white/[0.08]'
        }`}>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Collateral at Risk</div>
          <div className={`text-2xl font-bold tabular-nums ${
            simulation.collateralAtRiskUsd > 0 ? 'text-amber-400' : 'text-white/30'
          }`}>
            {formatUsd(simulation.collateralAtRiskUsd)}
          </div>
          {simulation.collateralAtRiskUsd !== currentState.collateralAtRiskUsd && (
            <div className={`text-xs mt-1 ${
              simulation.collateralAtRiskUsd > currentState.collateralAtRiskUsd ? 'text-amber-300' : 'text-emerald-300'
            }`}>
              {simulation.collateralAtRiskUsd > currentState.collateralAtRiskUsd ? '+' : ''}
              {formatUsd(simulation.collateralAtRiskUsd - currentState.collateralAtRiskUsd)}
            </div>
          )}
        </div>
      </div>

      {/* Context note */}
      <div className="mt-4 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Simulates base asset (SUI, DEEP, etc.) price changes. Quote assets assumed stable.
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Liquidation Analytics - Risk distribution histogram + price sensitivity simulator
 */
export function LiquidationAnalytics({
  positions,
  riskDistribution,
  isLoading,
}: LiquidationAnalyticsProps) {
  const [histogramMode, setHistogramMode] = React.useState<HistogramMode>('count');

  if (isLoading && positions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-white/[0.03] rounded-xl animate-pulse" />
        <div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" />
        <div className="h-80 bg-white/[0.03] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Risk Distribution Histogram */}
      <RiskDistributionHistogram
        riskDistribution={riskDistribution}
        histogramMode={histogramMode}
        onModeChange={setHistogramMode}
        totalPositions={positions.length}
      />

      {/* Price Sensitivity Simulator */}
      <PriceSensitivitySimulator positions={positions} />

      {/* Stress Curve Chart - Signature visual */}
      <StressCurveChart positions={positions} isLoading={isLoading} />

      {/* Analytics footer */}
      <p className="text-[10px] text-white/25 text-center">
        All simulations are estimates based on current on-chain data. Actual liquidation outcomes may vary due to oracle updates and market conditions.
      </p>
    </div>
  );
}
