import React from 'react';
import { type AtRiskPosition } from '../../../hooks/useAtRiskPositions';
import { DepthGaugeIcon, BoltIcon } from '../../../components/ThemedIcons';

interface PriceSensitivitySimulatorProps {
  positions: AtRiskPosition[];
  isLoading: boolean;
}

interface SimulationResult {
  priceChange: number;
  newLiquidatableCount: number;
  newAtRiskCount: number;
  totalNewDebtAtRiskUsd: number;
  positionsAffected: number;
}

/**
 * Simulate what happens to positions if prices change
 */
function simulatePositionsWithPriceChange(
  positions: AtRiskPosition[],
  basePriceChangePct: number, // e.g., -10 for 10% drop
  quotePriceChangePct: number = 0 // Stablecoin typically stays flat
): SimulationResult {
  // Calculate how price change affects risk ratio
  // Risk Ratio = (Collateral Value) / (Debt Value)
  // If SUI price drops, positions long SUI (collateral in SUI) become riskier
  // If SUI price drops, positions short SUI (debt in SUI) become healthier
  
  let newLiquidatableCount = 0;
  let newAtRiskCount = 0;
  let totalNewDebtAtRiskUsd = 0;
  let positionsAffected = 0;

  positions.forEach(position => {
    // Recalculate collateral value with new prices
    const basePriceMultiplier = 1 + (basePriceChangePct / 100);
    const quotePriceMultiplier = 1 + (quotePriceChangePct / 100);
    
    // New USD values of assets and debts
    const newBaseAssetUsd = position.baseAssetUsd * basePriceMultiplier;
    const newQuoteAssetUsd = position.quoteAssetUsd * quotePriceMultiplier;
    const newBaseDebtUsd = position.baseDebtUsd * basePriceMultiplier;
    const newQuoteDebtUsd = position.quoteDebtUsd * quotePriceMultiplier;
    
    const newCollateralValueUsd = newBaseAssetUsd + newQuoteAssetUsd;
    const newDebtValueUsd = newBaseDebtUsd + newQuoteDebtUsd;
    
    // Calculate new risk ratio
    const newRiskRatio = newDebtValueUsd > 0 
      ? newCollateralValueUsd / newDebtValueUsd 
      : 999;
    
    // Check if status changed
    const wasLiquidatable = position.isLiquidatable;
    const isNowLiquidatable = newRiskRatio <= position.liquidationThreshold;
    
    if (!wasLiquidatable && isNowLiquidatable) {
      positionsAffected++;
    }
    
    if (isNowLiquidatable) {
      newLiquidatableCount++;
      totalNewDebtAtRiskUsd += newDebtValueUsd;
    }
    
    // At-risk = within 20% of liquidation
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

/**
 * Format USD value for display
 */
function formatUsd(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Price Sensitivity Simulator Component
 * Shows what happens to liquidations if prices change
 */
export function PriceSensitivitySimulator({
  positions,
  isLoading,
}: PriceSensitivitySimulatorProps) {
  // Price change slider state (-50% to +50%)
  const [priceChangePct, setPriceChangePct] = React.useState(0);
  
  // Current state (0% change)
  const currentState = React.useMemo(() => 
    simulatePositionsWithPriceChange(positions, 0),
    [positions]
  );
  
  // Simulated state with user-selected price change
  const simulatedState = React.useMemo(() =>
    simulatePositionsWithPriceChange(positions, priceChangePct),
    [positions, priceChangePct]
  );
  
  // Pre-calculate common scenarios for the chart
  const scenarios = React.useMemo(() => {
    const changes = [-30, -20, -15, -10, -5, 0, 5, 10, 15, 20, 30];
    return changes.map(change => simulatePositionsWithPriceChange(positions, change));
  }, [positions]);
  
  // Find the max count for chart scaling
  const maxCount = Math.max(...scenarios.map(s => s.newLiquidatableCount), 1);
  
  // Current base price from first position
  const currentBasePrice = positions[0]?.basePythPrice 
    ? positions[0].basePythPrice / Math.pow(10, Math.abs(positions[0].basePythDecimals || 0))
    : 0;
  
  const simulatedPrice = currentBasePrice * (1 + priceChangePct / 100);

  if (isLoading && positions.length === 0) {
    return (
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="h-32 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-2xl border border-cyan-500/30 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <DepthGaugeIcon size={24} />
            Price Sensitivity Simulator
          </h3>
          <p className="text-sm text-white/60 mt-1">
            See how price changes affect liquidation opportunities
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-white/60">Current {positions[0]?.baseAssetSymbol || 'SUI'} Price</div>
          <div className="text-lg font-bold text-white">${currentBasePrice.toFixed(2)}</div>
        </div>
      </div>

      {/* Price Change Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white/80">
            Simulate {positions[0]?.baseAssetSymbol || 'SUI'} Price Change
          </label>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${
              priceChangePct < 0 ? 'text-rose-400' : 
              priceChangePct > 0 ? 'text-cyan-400' : 
              'text-white'
            }`}>
              {priceChangePct > 0 ? '+' : ''}{priceChangePct}%
            </span>
            <span className="text-white/60">→</span>
            <span className="text-lg font-bold text-teal-300">
              ${simulatedPrice.toFixed(2)}
            </span>
          </div>
        </div>
        
        {/* Slider Track */}
        <div className="relative">
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={priceChangePct}
            onChange={(e) => setPriceChangePct(Number(e.target.value))}
            className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-6
                       [&::-webkit-slider-thumb]:h-6
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-amber-500
                       [&::-webkit-slider-thumb]:border-2
                       [&::-webkit-slider-thumb]:border-white
                       [&::-webkit-slider-thumb]:shadow-lg
                       [&::-webkit-slider-thumb]:cursor-grab
                       [&::-webkit-slider-thumb]:transition-transform
                       [&::-webkit-slider-thumb]:hover:scale-110"
          />
          {/* Scale labels */}
          <div className="flex justify-between mt-1 text-xs text-white/40">
            <span>-50%</span>
            <span>-25%</span>
            <span>0%</span>
            <span>+25%</span>
            <span>+50%</span>
          </div>
        </div>
        
        {/* Quick select buttons */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {[-30, -20, -10, -5, 0, 5, 10, 20, 30].map(change => (
            <button
              key={change}
              onClick={() => setPriceChangePct(change)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                priceChangePct === change
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
              }`}
            >
              {change > 0 ? '+' : ''}{change}%
            </button>
          ))}
        </div>
      </div>

      {/* Results Comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Current State */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3">Current State</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-white/70">Liquidatable:</span>
              <span className="font-bold text-white">{currentState.newLiquidatableCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">At-Risk:</span>
              <span className="font-bold text-white">{currentState.newAtRiskCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Debt at Risk:</span>
              <span className="font-bold text-white">{formatUsd(currentState.totalNewDebtAtRiskUsd)}</span>
            </div>
          </div>
        </div>

        {/* Simulated State */}
        <div className={`rounded-xl p-4 border ${
          priceChangePct === 0 
            ? 'bg-white/5 border-white/10' 
            : simulatedState.newLiquidatableCount > currentState.newLiquidatableCount
              ? 'bg-white/5 border-rose-500/40'
              : 'bg-white/5 border-cyan-500/40'
        }`}>
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3">
            {priceChangePct === 0 ? 'Simulated State' : `If ${priceChangePct > 0 ? '+' : ''}${priceChangePct}%`}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white/70">Liquidatable:</span>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${
                  simulatedState.newLiquidatableCount > currentState.newLiquidatableCount
                    ? 'text-rose-400'
                    : simulatedState.newLiquidatableCount < currentState.newLiquidatableCount
                      ? 'text-cyan-400'
                      : 'text-white'
                }`}>
                  {simulatedState.newLiquidatableCount}
                </span>
                {simulatedState.positionsAffected > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-rose-500/20 text-rose-300 rounded">
                    +{simulatedState.positionsAffected} new
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">At-Risk:</span>
              <span className={`font-bold ${
                simulatedState.newAtRiskCount > currentState.newAtRiskCount
                  ? 'text-teal-400'
                  : 'text-white'
              }`}>
                {simulatedState.newAtRiskCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Debt at Risk:</span>
              <span className={`font-bold ${
                simulatedState.totalNewDebtAtRiskUsd > currentState.totalNewDebtAtRiskUsd
                  ? 'text-teal-400'
                  : 'text-white'
              }`}>
                {formatUsd(simulatedState.totalNewDebtAtRiskUsd)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Bar Chart - Liquidations by Price Change */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-white/80">Liquidatable Positions by Price Change</div>
        <div className="flex items-end justify-between gap-1 h-24">
          {scenarios.map((scenario, idx) => {
            const heightPct = (scenario.newLiquidatableCount / maxCount) * 100;
            const isSelected = scenario.priceChange === priceChangePct;
            const isCurrent = scenario.priceChange === 0;
            
            return (
              <button
                key={idx}
                onClick={() => setPriceChangePct(scenario.priceChange)}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                {/* Bar */}
                <div className="w-full relative" style={{ height: '80px' }}>
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-t transition-all ${
                      isSelected
                        ? 'bg-amber-500'
                        : scenario.priceChange < 0
                          ? 'bg-rose-500/40 group-hover:bg-rose-500/60'
                          : 'bg-cyan-500/40 group-hover:bg-cyan-500/60'
                    } ${isCurrent ? 'border-2 border-white/50' : ''}`}
                    style={{ height: `${Math.max(heightPct, 5)}%` }}
                  />
                  {/* Count label */}
                  <div className={`absolute -top-5 left-0 right-0 text-center text-xs ${
                    isSelected ? 'text-teal-300 font-bold' : 'text-white/40'
                  }`}>
                    {scenario.newLiquidatableCount}
                  </div>
                </div>
                {/* Price change label */}
                <div className={`text-xs ${
                  isSelected ? 'text-teal-300 font-bold' : 'text-white/40'
                }`}>
                  {scenario.priceChange > 0 ? '+' : ''}{scenario.priceChange}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Insight Box */}
      {priceChangePct !== 0 && simulatedState.positionsAffected > 0 && (
        <div className="bg-white/5 rounded-xl p-4 border border-amber-500/40">
          <div className="flex items-start gap-3">
            <BoltIcon size={28} />
            <div>
              <div className="font-semibold text-teal-300 mb-1">Opportunity Alert</div>
              <p className="text-sm text-white/80">
                A <span className="font-bold text-teal-300">{priceChangePct}%</span> price{' '}
                {priceChangePct < 0 ? 'drop' : 'increase'} would make{' '}
                <span className="font-bold text-teal-300">{simulatedState.positionsAffected}</span> additional 
                position{simulatedState.positionsAffected !== 1 ? 's' : ''} liquidatable, 
                representing <span className="font-bold text-teal-300">
                  {formatUsd(simulatedState.totalNewDebtAtRiskUsd - currentState.totalNewDebtAtRiskUsd)}
                </span> in new debt at risk.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-white/40 text-center">
        This is a simulation based on current position data. Actual results may vary due to 
        oracle price feeds, gas costs, and competing liquidators.
      </p>
    </div>
  );
}

