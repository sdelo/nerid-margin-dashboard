import React from 'react';
import { type AtRiskPosition } from '../../../hooks/useAtRiskPositions';

interface PositionDetailDrawerProps {
  position: AtRiskPosition;
  allPositions: AtRiskPosition[];
  isOpen: boolean;
  onClose: () => void;
  onLiquidate: (position: AtRiskPosition) => void;
  onViewHistory: (position: AtRiskPosition) => void;
}

/**
 * Format address for display
 */
function formatAddress(address: string): string {
  if (!address || address.length < 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

/**
 * Format USD value
 */
function formatUsd(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Calculate liquidation details for a position
 */
function calculateLiquidationDetails(position: AtRiskPosition): {
  maxRepayUsd: number;
  maxRepayAsset: string;
  maxRepayAmount: number;
  seizeAsset: string;
  seizeAmountUsd: number;
  liquidationBonus: number;
  grossReward: number;
  estimatedGas: number;
  estimatedSlippage: number;
  netProfit: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
} {
  // Max repay is typically 50% of debt or the full debt if underwater
  const closeFactorPct = position.riskRatio < 1.0 ? 1.0 : 0.5;
  const maxRepayUsd = position.totalDebtUsd * closeFactorPct;
  
  // Determine repay asset (the one with debt)
  const hasBaseDebt = position.baseDebtUsd > 0;
  const hasQuoteDebt = position.quoteDebtUsd > 0;
  
  let maxRepayAsset = position.quoteAssetSymbol;
  let maxRepayAmount = position.quoteDebt / 1e6;
  
  if (hasBaseDebt && (!hasQuoteDebt || position.baseDebtUsd > position.quoteDebtUsd)) {
    maxRepayAsset = position.baseAssetSymbol;
    maxRepayAmount = position.baseDebt / 1e9;
  }
  
  // Seize asset (the collateral)
  const hasBaseCollateral = position.baseAssetUsd > 0;
  const seizeAsset = hasBaseCollateral ? position.baseAssetSymbol : position.quoteAssetSymbol;
  const seizeAmountUsd = hasBaseCollateral ? position.baseAssetUsd : position.quoteAssetUsd;
  
  // Bonus is typically 3-5% (user reward + pool reward)
  const liquidationBonus = (position.userLiquidationRewardPct + position.poolLiquidationRewardPct) * 100;
  const grossReward = position.estimatedRewardUsd;
  
  // Costs
  const estimatedGas = 0.50; // ~$0.50 in gas on SUI
  const estimatedSlippage = position.totalDebtUsd * 0.003; // ~0.3% slippage estimate
  const netProfit = grossReward - estimatedGas - estimatedSlippage;
  
  // Confidence assessment
  const confidenceReasons: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  if (!position.isLiquidatable) {
    confidence = 'low';
    confidenceReasons.push('Position not yet liquidatable');
  } else {
    // Check profitability
    if (netProfit > 10) {
      confidenceReasons.push('Good profit margin');
    } else if (netProfit > 0) {
      confidence = 'medium';
      confidenceReasons.push('Marginal profit');
    } else {
      confidence = 'low';
      confidenceReasons.push('Unprofitable after costs');
    }
    
    // Check position size
    if (position.totalDebtUsd < 100) {
      if (confidence === 'high') confidence = 'medium';
      confidenceReasons.push('Small position size');
    } else if (position.totalDebtUsd > 10000) {
      confidenceReasons.push('Large position');
    }
    
    // Check how underwater
    if (position.riskRatio < 0.95) {
      confidence = 'high';
      confidenceReasons.push('Deeply underwater');
    }
  }
  
  return {
    maxRepayUsd,
    maxRepayAsset,
    maxRepayAmount: maxRepayAmount * closeFactorPct,
    seizeAsset,
    seizeAmountUsd,
    liquidationBonus,
    grossReward,
    estimatedGas,
    estimatedSlippage,
    netProfit,
    confidence,
    confidenceReasons,
  };
}

/**
 * Simulate what happens to a single position if prices change
 */
function simulatePositionWithPriceChange(
  position: AtRiskPosition,
  basePriceChangePct: number
): {
  newHealthFactor: number;
  newPriceBuffer: number;
  isLiquidatable: boolean;
  newDebtUsd: number;
  newCollateralUsd: number;
} {
  const basePriceMultiplier = 1 + (basePriceChangePct / 100);
  
  const newBaseAssetUsd = position.baseAssetUsd * basePriceMultiplier;
  const newQuoteAssetUsd = position.quoteAssetUsd; // Stablecoin
  const newBaseDebtUsd = position.baseDebtUsd * basePriceMultiplier;
  const newQuoteDebtUsd = position.quoteDebtUsd;
  
  const newCollateralUsd = newBaseAssetUsd + newQuoteAssetUsd;
  const newDebtUsd = newBaseDebtUsd + newQuoteDebtUsd;
  
  const newHealthFactor = newDebtUsd > 0 ? newCollateralUsd / newDebtUsd : 999;
  const newPriceBuffer = ((newHealthFactor - position.liquidationThreshold) / position.liquidationThreshold) * 100;
  const isLiquidatable = newHealthFactor <= position.liquidationThreshold;
  
  return {
    newHealthFactor,
    newPriceBuffer,
    isLiquidatable,
    newDebtUsd,
    newCollateralUsd,
  };
}

/**
 * Confidence Badge Component
 */
function ConfidenceBadge({ confidence, reasons }: { confidence: 'high' | 'medium' | 'low'; reasons: string[] }) {
  const styles = {
    high: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    low: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  };
  
  const labels = {
    high: 'High Confidence',
    medium: 'Medium Confidence',
    low: 'Low Confidence',
  };
  
  return (
    <div className="group relative">
      <span className={`px-2 py-1 text-[10px] font-bold rounded border ${styles[confidence]}`}>
        {labels[confidence]}
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
        <div className="bg-slate-900 border border-white/20 rounded-lg px-3 py-2 shadow-xl min-w-[150px]">
          <div className="text-[10px] text-white/60 mb-1">Confidence factors:</div>
          <ul className="text-[10px] text-white/80 space-y-0.5">
            {reasons.map((reason, idx) => (
              <li key={idx} className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-white/40" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Position Detail Drawer - Slide-in panel with position details, execution breakdown, and simulator
 */
export function PositionDetailDrawer({
  position,
  allPositions,
  isOpen,
  onClose,
  onLiquidate,
  onViewHistory,
}: PositionDetailDrawerProps) {
  const [priceChangePct, setPriceChangePct] = React.useState(0);
  
  // Current base price from position
  const currentBasePrice = position.basePythPrice 
    ? position.basePythPrice / Math.pow(10, Math.abs(position.basePythDecimals || 0))
    : 0;
  
  const simulatedPrice = currentBasePrice * (1 + priceChangePct / 100);
  const simulation = simulatePositionWithPriceChange(position, priceChangePct);
  const liqDetails = calculateLiquidationDetails(position);
  
  // Reset price slider when position changes
  React.useEffect(() => {
    setPriceChangePct(0);
  }, [position.marginManagerId]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-white/10 z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 p-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <h2 className="text-sm font-semibold text-white">Position Details</h2>
              <ConfidenceBadge confidence={liqDetails.confidence} reasons={liqDetails.confidenceReasons} />
            </div>
            <a
              href={`https://suivision.xyz/object/${position.marginManagerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
            >
              {formatAddress(position.marginManagerId)}
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 space-y-4">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {position.isLiquidatable ? (
              <span className="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                ⚠️ LIQUIDATABLE
              </span>
            ) : position.distanceToLiquidation < 5 ? (
              <span className="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                CRITICAL
              </span>
            ) : position.distanceToLiquidation < 15 ? (
              <span className="px-2 py-1 text-xs font-bold rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                WARNING
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                WATCHING
              </span>
            )}
            <span className="text-xs text-white/40">
              {position.baseAssetSymbol}/{position.quoteAssetSymbol}
            </span>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] text-white/50 mb-0.5">Health Factor</div>
              <div className={`text-lg font-bold tabular-nums ${
                position.isLiquidatable ? 'text-rose-400' :
                position.distanceToLiquidation < 5 ? 'text-amber-400' :
                position.distanceToLiquidation < 15 ? 'text-yellow-400' :
                'text-emerald-400'
              }`}>
                {position.riskRatio.toFixed(3)}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                Liq @ {position.liquidationThreshold.toFixed(2)}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] text-white/50 mb-0.5">Price Buffer</div>
              <div className={`text-lg font-bold tabular-nums ${
                position.distanceToLiquidation < 0 ? 'text-rose-400' :
                position.distanceToLiquidation < 5 ? 'text-amber-400' :
                position.distanceToLiquidation < 15 ? 'text-yellow-400' :
                'text-emerald-400'
              }`}>
                {position.distanceToLiquidation < 0 ? '' : '+'}
                {position.distanceToLiquidation.toFixed(1)}%
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                Until liquidation
              </div>
            </div>
          </div>

          {/* Execution Breakdown */}
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/30 rounded-lg p-3 border border-white/10 space-y-3">
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <svg className="w-3 h-3 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Execution Breakdown
            </h3>
            
            {/* Execution steps */}
            <div className="space-y-2">
              {/* Step 1: Repay */}
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-cyan-400">1</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-white/50">Repay Debt</div>
                  <div className="text-xs font-medium text-white">
                    {liqDetails.maxRepayAmount.toFixed(4)} {liqDetails.maxRepayAsset}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-cyan-400 tabular-nums">
                    {formatUsd(liqDetails.maxRepayUsd)}
                  </div>
                </div>
              </div>
              
              {/* Step 2: Seize */}
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-emerald-400">2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-white/50">Seize</div>
                  <div className="text-xs font-medium text-white">
                    {liqDetails.seizeAsset}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400 tabular-nums">
                    {formatUsd(liqDetails.seizeAmountUsd)}
                  </div>
                </div>
              </div>
              
              {/* Step 3: Bonus */}
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-amber-400">3</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-white/50">Bonus</div>
                  <div className="text-xs font-medium text-white">
                    {liqDetails.liquidationBonus.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-amber-400 tabular-nums">
                    +{formatUsd(liqDetails.grossReward)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Profit Summary */}
            <div className="pt-2 border-t border-white/10 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Gross</span>
                <span className="text-emerald-400 font-medium tabular-nums">+{formatUsd(liqDetails.grossReward)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Gas + Slip</span>
                <span className="text-rose-400 tabular-nums">-{formatUsd(liqDetails.estimatedGas + liqDetails.estimatedSlippage)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-white/10">
                <span className="text-white font-medium text-xs">Net Profit</span>
                <span className={`font-bold text-sm tabular-nums ${liqDetails.netProfit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {liqDetails.netProfit > 0 ? '+' : ''}{formatUsd(liqDetails.netProfit)}
                </span>
              </div>
            </div>
            
            {/* Confidence indicator */}
            <div className={`p-2 rounded ${
              liqDetails.confidence === 'high' ? 'bg-emerald-500/10 border border-emerald-500/20' :
              liqDetails.confidence === 'medium' ? 'bg-amber-500/10 border border-amber-500/20' :
              'bg-rose-500/10 border border-rose-500/20'
            }`}>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  liqDetails.confidence === 'high' ? 'bg-emerald-500' :
                  liqDetails.confidence === 'medium' ? 'bg-amber-500' :
                  'bg-rose-500'
                }`} />
                <span className="text-[10px] text-white/80">
                  {liqDetails.confidenceReasons.join(' · ')}
                </span>
              </div>
            </div>
          </div>

          {/* Position Breakdown */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-3">
            <h3 className="text-xs font-semibold text-white/80">Position Breakdown</h3>
            
            {/* Collateral */}
            <div>
              <div className="text-[10px] text-white/50 mb-1.5">Collateral</div>
              <div className="space-y-1.5">
                {position.baseAsset > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/70">{position.baseAssetSymbol}</span>
                    <div className="text-right">
                      <span className="font-medium text-white">
                        {(position.baseAsset / 1e9).toFixed(4)}
                      </span>
                      <span className="text-[10px] text-white/40 ml-1.5">
                        {formatUsd(position.baseAssetUsd)}
                      </span>
                    </div>
                  </div>
                )}
                {position.quoteAsset > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/70">{position.quoteAssetSymbol}</span>
                    <div className="text-right">
                      <span className="font-medium text-white">
                        {(position.quoteAsset / 1e6).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-white/40 ml-1.5">
                        {formatUsd(position.quoteAssetUsd)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-white/10 text-xs">
                  <span className="font-medium text-white/80">Total</span>
                  <span className="font-bold text-white">
                    {formatUsd(position.baseAssetUsd + position.quoteAssetUsd)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Debt */}
            <div>
              <div className="text-[10px] text-white/50 mb-1.5">Debt</div>
              <div className="space-y-1.5">
                {position.baseDebt > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/70">{position.baseAssetSymbol}</span>
                    <div className="text-right">
                      <span className="font-medium text-rose-400">
                        {(position.baseDebt / 1e9).toFixed(4)}
                      </span>
                      <span className="text-[10px] text-white/40 ml-1.5">
                        {formatUsd(position.baseDebtUsd)}
                      </span>
                    </div>
                  </div>
                )}
                {position.quoteDebt > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/70">{position.quoteAssetSymbol}</span>
                    <div className="text-right">
                      <span className="font-medium text-rose-400">
                        {(position.quoteDebt / 1e6).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-white/40 ml-1.5">
                        {formatUsd(position.quoteDebtUsd)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-white/10 text-xs">
                  <span className="font-medium text-white/80">Total</span>
                  <span className="font-bold text-rose-400">
                    {formatUsd(position.totalDebtUsd)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Price Simulator */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-lg p-3 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Price Simulator
              </h3>
              <div className="text-right">
                <div className="text-[10px] text-white/50">{position.baseAssetSymbol}</div>
                <div className="text-xs font-bold text-white">${currentBasePrice.toFixed(4)}</div>
              </div>
            </div>

            {/* Price Change Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Simulate:</span>
                <span className={`font-bold ${
                  priceChangePct < 0 ? 'text-rose-400' : 
                  priceChangePct > 0 ? 'text-emerald-400' : 
                  'text-white'
                }`}>
                  {priceChangePct > 0 ? '+' : ''}{priceChangePct}% → ${simulatedPrice.toFixed(4)}
                </span>
              </div>
              
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={priceChangePct}
                onChange={(e) => setPriceChangePct(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none
                           [&::-webkit-slider-thumb]:w-3
                           [&::-webkit-slider-thumb]:h-3
                           [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-cyan-400
                           [&::-webkit-slider-thumb]:border-2
                           [&::-webkit-slider-thumb]:border-white
                           [&::-webkit-slider-thumb]:cursor-grab"
              />
              
              <div className="flex justify-between text-[10px] text-white/40">
                <span>-50%</span>
                <span>0%</span>
                <span>+50%</span>
              </div>
            </div>

            {/* Simulation Results */}
            {priceChangePct !== 0 && (
              <div className={`rounded p-2 ${
                simulation.isLiquidatable 
                  ? 'bg-rose-500/20 border border-rose-500/40' 
                  : 'bg-white/5 border border-white/10'
              }`}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-white/50">New Health</div>
                    <div className={`font-bold ${simulation.isLiquidatable ? 'text-rose-400' : 'text-white'}`}>
                      {simulation.newHealthFactor.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50">New Buffer</div>
                    <div className={`font-bold ${simulation.isLiquidatable ? 'text-rose-400' : 'text-white'}`}>
                      {simulation.newPriceBuffer < 0 ? '' : '+'}{simulation.newPriceBuffer.toFixed(1)}%
                    </div>
                  </div>
                </div>
                {simulation.isLiquidatable && !position.isLiquidatable && (
                  <div className="mt-1.5 text-[10px] text-rose-300 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Becomes liquidatable
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-white/10">
            <button
              onClick={() => onViewHistory(position)}
              className="flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </button>
            
            {position.isLiquidatable ? (
              <button
                onClick={() => onLiquidate(position)}
                className="flex-1 px-3 py-2.5 rounded-lg text-xs font-bold transition-all bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Liquidate
              </button>
            ) : (
              <button
                disabled
                className="flex-1 px-3 py-2.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-500 cursor-not-allowed"
              >
                Not Liquidatable
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
