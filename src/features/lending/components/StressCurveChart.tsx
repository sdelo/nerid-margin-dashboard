import React from 'react';
import { type AtRiskPosition } from '../../../hooks/useAtRiskPositions';

/**
 * Format price compactly (e.g., $3.21, $0.012, $15.4K)
 */
function formatPriceCompact(price: number): string {
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
  if (price >= 100) return `$${price.toFixed(0)}`;
  if (price >= 10) return `$${price.toFixed(1)}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(4)}`;
}

interface StressCurveChartProps {
  positions: AtRiskPosition[];
  isLoading: boolean;
}

interface SimulationPoint {
  priceChange: number;
  liquidatableCount: number;
  debtAtRiskUsd: number;
}

/**
 * Simulate positions at a given price change
 */
function simulateAtPriceChange(
  positions: AtRiskPosition[],
  priceChangePct: number
): { liquidatableCount: number; debtAtRiskUsd: number } {
  let liquidatableCount = 0;
  let debtAtRiskUsd = 0;

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
    }
  });

  return { liquidatableCount, debtAtRiskUsd };
}

/**
 * Calculate first liquidation point
 */
function calculateFirstLiquidationPoint(positions: AtRiskPosition[]): number | null {
  let closestDrop: number | null = null;

  positions.forEach((position) => {
    if (position.isLiquidatable) return;

    const threshold = position.liquidationThreshold;
    // Calculate collateral and debt from component fields
    const collateral = position.baseAssetUsd + position.quoteAssetUsd;
    const debt = position.totalDebtUsd;

    if (debt === 0) return;

    const netBaseExposure = position.baseAssetUsd - position.baseDebtUsd;

    if (Math.abs(netBaseExposure) > 0.01) {
      const targetCollateral = threshold * debt;
      const changeNeeded = (targetCollateral - collateral) / netBaseExposure;
      const pctChange = changeNeeded * 100;

      if (pctChange < 0 && (closestDrop === null || pctChange > closestDrop)) {
        closestDrop = pctChange;
      }
    }
  });

  return closestDrop;
}

/**
 * Find cliff point - where debt-at-risk jumps significantly
 */
function findCliffPoint(curveData: SimulationPoint[]): { pct: number; debtBefore: number; debtAfter: number; multiplier: number } | null {
  let maxJump = 0;
  let cliffPoint: { pct: number; debtBefore: number; debtAfter: number; multiplier: number } | null = null;
  
  for (let i = 1; i < curveData.length; i++) {
    const prev = curveData[i - 1].debtAtRiskUsd || 1;
    const curr = curveData[i].debtAtRiskUsd;
    const multiplier = prev > 0 ? curr / prev : curr > 0 ? 999 : 1;
    
    if (multiplier > maxJump && multiplier >= 2 && curr > 100) {
      maxJump = multiplier;
      cliffPoint = { 
        pct: curveData[i].priceChange, 
        debtBefore: prev, 
        debtAfter: curr,
        multiplier 
      };
    }
  }
  
  return cliffPoint;
}

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Stress Curve Chart - 2-metric chart: "Liquidations vs Price Shock"
 * Shows both # liquidatable and $ debt at risk
 * Answers: "How steep is the cliff?"
 */
export function StressCurveChart({ positions, isLoading }: StressCurveChartProps) {
  const [hoveredPoint, setHoveredPoint] = React.useState<SimulationPoint | null>(null);
  
  // Generate curve data points from -50% to +20%
  const curveData = React.useMemo((): SimulationPoint[] => {
    const points: SimulationPoint[] = [];
    // More granular on the downside where risk lives
    for (let pct = -50; pct <= 20; pct += 2) {
      const result = simulateAtPriceChange(positions, pct);
      points.push({
        priceChange: pct,
        liquidatableCount: result.liquidatableCount,
        debtAtRiskUsd: result.debtAtRiskUsd,
      });
    }
    return points;
  }, [positions]);

  // Find first liquidation point
  const firstLiquidationAt = React.useMemo(
    () => calculateFirstLiquidationPoint(positions),
    [positions]
  );
  
  // Find cliff point
  const cliffPoint = React.useMemo(
    () => findCliffPoint(curveData),
    [curveData]
  );

  // Current state (0%)
  const currentPoint = curveData.find((p) => p.priceChange === 0);

  // Get current base asset price from positions (first position with valid price)
  const currentPrice = React.useMemo(() => {
    const positionWithPrice = positions.find(p => p.basePythPrice > 0);
    if (!positionWithPrice) return null;
    // Convert Pyth price to USD
    const price = positionWithPrice.basePythPrice / Math.pow(10, Math.abs(positionWithPrice.basePythDecimals));
    return price;
  }, [positions]);

  // Calculate price at a given percentage change
  const getPriceAtPct = (pct: number): number | null => {
    if (currentPrice === null) return null;
    return currentPrice * (1 + pct / 100);
  };

  // Find max for scaling
  const maxLiquidatable = Math.max(...curveData.map((p) => p.liquidatableCount), 1);
  const maxDebt = Math.max(...curveData.map((p) => p.debtAtRiskUsd), 1);

  // Chart dimensions
  const chartHeight = 200;
  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 30;
  const paddingBottom = 55;
  const innerWidth = 600 - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // Volatility bands (typical daily move: ~5%, 95% weekly: ~15%)
  const dailyMove = 5; // ±5%
  const weeklyMove = 15; // ±15%

  // Scale functions
  const xScale = (pct: number) => {
    const normalized = (pct + 50) / 70; // -50 to +20 range
    return paddingLeft + normalized * innerWidth;
  };

  const yScaleCount = (count: number) => {
    const normalized = count / maxLiquidatable;
    return paddingTop + innerHeight - normalized * innerHeight;
  };
  
  const yScaleDebt = (debt: number) => {
    const normalized = debt / maxDebt;
    return paddingTop + innerHeight - normalized * innerHeight;
  };

  // Generate path for count line
  const countPathD = curveData
    .map((point, idx) => {
      const x = xScale(point.priceChange);
      const y = yScaleCount(point.liquidatableCount);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  
  // Generate path for debt line
  const debtPathD = curveData
    .map((point, idx) => {
      const x = xScale(point.priceChange);
      const y = yScaleDebt(point.debtAtRiskUsd);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Area path for debt (fill under curve)
  const debtAreaD =
    debtPathD +
    ` L ${xScale(20)} ${paddingTop + innerHeight} L ${xScale(-50)} ${paddingTop + innerHeight} Z`;

  // Current scenario position
  const currentX = xScale(0);
  
  // First liquidation position (if exists)
  const firstLiquidationX = firstLiquidationAt !== null ? xScale(firstLiquidationAt) : null;
  
  // Cliff position
  const cliffX = cliffPoint ? xScale(cliffPoint.pct) : null;

  if (isLoading && positions.length === 0) {
    return (
      <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-5">
        <div className="h-[220px] bg-white/[0.03] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-5">
        <h3 className="text-base font-semibold text-white mb-2">Stress Curve</h3>
        <p className="text-sm text-white/40">No positions to analyze</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            Stress Curve
          </h3>
          <p className="text-xs text-white/40 mt-0.5">Positions & debt at risk vs. price shock — how steep is the cliff?</p>
        </div>
        
        {/* Key callouts */}
        <div className="flex items-center gap-2 flex-wrap">
          {cliffPoint && (
            <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <span className="text-xs text-rose-300">
                At <span className="font-bold">{Math.abs(cliffPoint.pct)}%</span> drop, debt jumps{' '}
                <span className="font-bold">{cliffPoint.multiplier.toFixed(1)}×</span>
              </span>
            </div>
          )}
          {!cliffPoint && firstLiquidationAt !== null && !currentPoint?.liquidatableCount && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <span className="text-xs text-amber-300">
                First liquidation at{' '}
                <span className="font-bold">{Math.abs(firstLiquidationAt).toFixed(0)}%</span> drop
              </span>
            </div>
          )}
          {currentPoint && currentPoint.liquidatableCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <span className="text-xs text-rose-300">
                <span className="font-bold">{currentPoint.liquidatableCount}</span> liquidatable now ({formatUsd(currentPoint.debtAtRiskUsd)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg viewBox={`0 0 600 ${chartHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Gradient for debt area */}
            <linearGradient id="debtAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
            </linearGradient>
            {/* Gradient for volatility band */}
            <linearGradient id="volatilityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Weekly volatility band (±15%) */}
          <rect
            x={xScale(-weeklyMove)}
            y={paddingTop}
            width={xScale(weeklyMove) - xScale(-weeklyMove)}
            height={innerHeight}
            fill="url(#volatilityGradient)"
            rx="4"
          />
          
          {/* Daily volatility band (±5%) - darker */}
          <rect
            x={xScale(-dailyMove)}
            y={paddingTop}
            width={xScale(dailyMove) - xScale(-dailyMove)}
            height={innerHeight}
            fill="rgba(255,255,255,0.04)"
            rx="2"
          />

          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={paddingLeft}
              y1={paddingTop + innerHeight * (1 - ratio)}
              x2={paddingLeft + innerWidth}
              y2={paddingTop + innerHeight * (1 - ratio)}
              stroke="white"
              strokeOpacity="0.06"
            />
          ))}

          {/* Current scenario vertical line (0%) */}
          <line
            x1={currentX}
            y1={paddingTop}
            x2={currentX}
            y2={paddingTop + innerHeight}
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4,4"
          />
          <text
            x={currentX}
            y={paddingTop - 8}
            textAnchor="middle"
            className="fill-emerald-400 text-[9px] font-bold"
          >
            NOW
          </text>

          {/* First liquidation marker */}
          {firstLiquidationX !== null && firstLiquidationAt !== null && !currentPoint?.liquidatableCount && (
            <>
              <line
                x1={firstLiquidationX}
                y1={paddingTop}
                x2={firstLiquidationX}
                y2={paddingTop + innerHeight}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
            </>
          )}
          
          {/* Cliff marker */}
          {cliffX !== null && cliffPoint && (
            <>
              <line
                x1={cliffX}
                y1={paddingTop}
                x2={cliffX}
                y2={paddingTop + innerHeight}
                stroke="#f43f5e"
                strokeWidth="2"
                strokeDasharray="6,3"
              />
              <circle
                cx={cliffX}
                cy={yScaleDebt(cliffPoint.debtAfter)}
                r="6"
                fill="#f43f5e"
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={cliffX}
                y={paddingTop - 8}
                textAnchor="middle"
                className="fill-rose-400 text-[9px] font-bold"
              >
                CLIFF
              </text>
            </>
          )}

          {/* Area under debt curve */}
          <path d={debtAreaD} fill="url(#debtAreaGradient)" />

          {/* Debt line ($ at risk) - cyan */}
          <path
            d={debtPathD}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Count line (# liquidatable) - rose */}
          <path
            d={countPathD}
            fill="none"
            stroke="#fb7185"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points at key intervals */}
          {curveData
            .filter((p) => p.priceChange % 10 === 0)
            .map((point) => (
              <g key={point.priceChange}>
                {/* Count point */}
                <circle
                  cx={xScale(point.priceChange)}
                  cy={yScaleCount(point.liquidatableCount)}
                  r={point.priceChange === 0 ? 5 : 3}
                  fill={point.priceChange === 0 ? '#10b981' : '#fb7185'}
                  stroke="white"
                  strokeWidth={point.priceChange === 0 ? 2 : 1}
                />
                {/* Debt point */}
                <circle
                  cx={xScale(point.priceChange)}
                  cy={yScaleDebt(point.debtAtRiskUsd)}
                  r={point.priceChange === 0 ? 5 : 3}
                  fill={point.priceChange === 0 ? '#10b981' : '#22d3ee'}
                  stroke="white"
                  strokeWidth={point.priceChange === 0 ? 2 : 1}
                />
              </g>
            ))}

          {/* Left Y-axis labels (Count) */}
          <text
            x={paddingLeft - 8}
            y={paddingTop}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-rose-400 text-[9px]"
          >
            {maxLiquidatable}
          </text>
          <text
            x={paddingLeft - 8}
            y={paddingTop + innerHeight}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-rose-400 text-[9px]"
          >
            0
          </text>
          <text
            x={paddingLeft - 8}
            y={paddingTop + innerHeight / 2}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-rose-400 text-[9px]"
          >
            {Math.round(maxLiquidatable / 2)}
          </text>
          
          {/* Right Y-axis labels (Debt) */}
          <text
            x={paddingLeft + innerWidth + 8}
            y={paddingTop}
            textAnchor="start"
            dominantBaseline="middle"
            className="fill-cyan-400 text-[9px]"
          >
            {formatUsd(maxDebt)}
          </text>
          <text
            x={paddingLeft + innerWidth + 8}
            y={paddingTop + innerHeight}
            textAnchor="start"
            dominantBaseline="middle"
            className="fill-cyan-400 text-[9px]"
          >
            $0
          </text>

          {/* X-axis labels - percentage and price */}
          {[-50, -40, -30, -20, -10, 0, 10, 20].map((pct) => {
            const priceAtPct = getPriceAtPct(pct);
            return (
              <g key={pct}>
                {/* Percentage label */}
                <text
                  x={xScale(pct)}
                  y={paddingTop + innerHeight + 14}
                  textAnchor="middle"
                  className={`text-[9px] ${pct === 0 ? 'fill-emerald-400 font-bold' : 'fill-white/40'}`}
                >
                  {pct > 0 ? '+' : ''}
                  {pct}%
                </text>
                {/* Price label */}
                {priceAtPct !== null && (
                  <text
                    x={xScale(pct)}
                    y={paddingTop + innerHeight + 26}
                    textAnchor="middle"
                    className={`text-[8px] ${pct === 0 ? 'fill-emerald-400/70' : 'fill-white/25'}`}
                  >
                    {formatPriceCompact(priceAtPct)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Axis titles */}
          <text
            x={paddingLeft + innerWidth / 2}
            y={chartHeight - 6}
            textAnchor="middle"
            className="fill-white/30 text-[8px] uppercase tracking-wider"
          >
            Price Change
          </text>
          <text
            x={10}
            y={paddingTop + innerHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90, 10, ${paddingTop + innerHeight / 2})`}
            className="fill-rose-400 text-[8px] uppercase tracking-wider"
          >
            # Positions
          </text>
          <text
            x={590}
            y={paddingTop + innerHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(90, 590, ${paddingTop + innerHeight / 2})`}
            className="fill-cyan-400 text-[8px] uppercase tracking-wider"
          >
            $ At Risk
          </text>
          
          {/* Volatility band labels */}
          <text
            x={xScale(-dailyMove) + 2}
            y={paddingTop + innerHeight - 4}
            className="fill-white/20 text-[7px]"
          >
            ±5% daily
          </text>
          <text
            x={xScale(-weeklyMove) + 2}
            y={paddingTop + innerHeight - 4}
            className="fill-white/15 text-[7px]"
          >
            ±15% weekly
          </text>
        </svg>
      </div>

      {/* Summary stats and legend */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06] flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-400 rounded" />
            <span className="text-white/50"># Liquidatable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 rounded" />
            <span className="text-white/50">$ Debt at Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 rounded" />
            <span className="text-white/50">Current price</span>
          </div>
          {cliffPoint && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-white/50">Cliff point</span>
            </div>
          )}
        </div>
        
        {/* Hover info or summary */}
        <div className="text-xs text-white/40">
          <span className="text-white/30">At -30%{currentPrice !== null && ` (${formatPriceCompact(getPriceAtPct(-30)!)})`}:</span>{' '}
          <span className="text-rose-400 font-medium">
            {curveData.find((p) => p.priceChange === -30)?.liquidatableCount || 0} positions
          </span>
          {' · '}
          <span className="text-cyan-400 font-medium">
            {formatUsd(curveData.find((p) => p.priceChange === -30)?.debtAtRiskUsd || 0)}
          </span>
        </div>
      </div>
      
      {/* Probability context */}
      <div className="mt-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <span className="text-white/60">Shaded bands show typical volatility:</span>{' '}
            ±5% moves happen daily, ±15% moves happen weekly (95th percentile)
          </span>
        </div>
      </div>
    </div>
  );
}
