import React from 'react';
import { type AtRiskPosition, getPositionDirection } from '../../../hooks/useAtRiskPositions';
import { useScenario, type ShockAsset, simulateAllPositions } from '../../../context/ScenarioContext';

interface InteractiveStressCurveProps {
  positions: AtRiskPosition[];
  isLoading: boolean;
}

interface SimulationPoint {
  priceChange: number;
  liquidatableCount: number;
  debtAtRiskUsd: number;
  // Breakdown by position direction
  longLiquidatableCount: number;
  shortLiquidatableCount: number;
  longDebtAtRiskUsd: number;
  shortDebtAtRiskUsd: number;
}

/**
 * Simulate positions at a given price change
 * Returns total counts and breakdown by position direction (long vs short)
 */
function simulateAtPriceChange(
  positions: AtRiskPosition[],
  priceChangePct: number,
  shockAsset: ShockAsset
): { 
  liquidatableCount: number; 
  debtAtRiskUsd: number;
  longLiquidatableCount: number;
  shortLiquidatableCount: number;
  longDebtAtRiskUsd: number;
  shortDebtAtRiskUsd: number;
} {
  let liquidatableCount = 0;
  let debtAtRiskUsd = 0;
  let longLiquidatableCount = 0;
  let shortLiquidatableCount = 0;
  let longDebtAtRiskUsd = 0;
  let shortDebtAtRiskUsd = 0;

  positions.forEach((position) => {
    const shouldShockBase = shockAsset === 'ALL' || shockAsset === position.baseAssetSymbol;
    const basePriceMultiplier = shouldShockBase ? 1 + priceChangePct / 100 : 1;
    
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
      
      // Classify by position direction
      const { direction } = getPositionDirection(position);
      if (direction === 'LONG') {
        longLiquidatableCount++;
        longDebtAtRiskUsd += newDebtValueUsd;
      } else if (direction === 'SHORT') {
        shortLiquidatableCount++;
        shortDebtAtRiskUsd += newDebtValueUsd;
      } else {
        // Neutral positions - count as long for simplicity
        longLiquidatableCount++;
        longDebtAtRiskUsd += newDebtValueUsd;
      }
    }
  });

  return { 
    liquidatableCount, 
    debtAtRiskUsd,
    longLiquidatableCount,
    shortLiquidatableCount,
    longDebtAtRiskUsd,
    shortDebtAtRiskUsd,
  };
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
 * Interactive Stress Curve Chart
 * Click to select a shock point, drag to select a range
 */
export function InteractiveStressCurve({ positions, isLoading }: InteractiveStressCurveProps) {
  const { shockAsset, shockPct, range, isActive, activateScenario, setRange, resetScenario } = useScenario();
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<number | null>(null);
  const [hoveredPct, setHoveredPct] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Generate curve data points from -50% to +20%
  const curveData = React.useMemo((): SimulationPoint[] => {
    const points: SimulationPoint[] = [];
    for (let pct = -50; pct <= 20; pct += 2) {
      const result = simulateAtPriceChange(positions, pct, shockAsset);
      points.push({
        priceChange: pct,
        liquidatableCount: result.liquidatableCount,
        debtAtRiskUsd: result.debtAtRiskUsd,
        longLiquidatableCount: result.longLiquidatableCount,
        shortLiquidatableCount: result.shortLiquidatableCount,
        longDebtAtRiskUsd: result.longDebtAtRiskUsd,
        shortDebtAtRiskUsd: result.shortDebtAtRiskUsd,
      });
    }
    return points;
  }, [positions, shockAsset]);
  
  // Calculate direction breakdown for current positions
  const directionStats = React.useMemo(() => {
    let long = 0, short = 0;
    positions.forEach(p => {
      const { direction } = getPositionDirection(p);
      if (direction === 'LONG') long++;
      else short++;
    });
    return { long, short };
  }, [positions]);

  // Find cliff point
  const cliffPoint = React.useMemo(
    () => findCliffPoint(curveData),
    [curveData]
  );

  // Current state (0%)
  const currentPoint = curveData.find((p) => p.priceChange === 0);
  
  // Selected point (at shockPct)
  const selectedPoint = curveData.find((p) => p.priceChange === shockPct) || 
    simulateAtPriceChange(positions, shockPct, shockAsset);

  // Find max for scaling
  const maxLiquidatable = Math.max(...curveData.map((p) => p.liquidatableCount), 1);
  const maxDebt = Math.max(...curveData.map((p) => p.debtAtRiskUsd), 1);

  // Chart dimensions
  const chartHeight = 160;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 25;
  const paddingBottom = 30;
  const innerWidth = 600 - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // Volatility bands
  const dailyMove = 5;
  const weeklyMove = 15;

  // Scale functions
  const xScale = (pct: number) => {
    const normalized = (pct + 50) / 70;
    return paddingLeft + normalized * innerWidth;
  };

  const xScaleInverse = (x: number): number => {
    const normalized = (x - paddingLeft) / innerWidth;
    return Math.round(normalized * 70 - 50);
  };

  const yScaleCount = (count: number) => {
    const normalized = count / maxLiquidatable;
    return paddingTop + innerHeight - normalized * innerHeight;
  };
  
  const yScaleDebt = (debt: number) => {
    const normalized = debt / maxDebt;
    return paddingTop + innerHeight - normalized * innerHeight;
  };

  // Generate path for count line (total)
  const countPathD = curveData
    .map((point, idx) => {
      const x = xScale(point.priceChange);
      const y = yScaleCount(point.liquidatableCount);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  
  // Generate path for LONG positions count (hurt by price drops)
  const longCountPathD = curveData
    .map((point, idx) => {
      const x = xScale(point.priceChange);
      const y = yScaleCount(point.longLiquidatableCount);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  
  // Generate path for SHORT positions count (hurt by price increases)
  const shortCountPathD = curveData
    .map((point, idx) => {
      const x = xScale(point.priceChange);
      const y = yScaleCount(point.shortLiquidatableCount);
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

  // Area path for debt
  const debtAreaD =
    debtPathD +
    ` L ${xScale(20)} ${paddingTop + innerHeight} L ${xScale(-50)} ${paddingTop + innerHeight} Z`;
  
  // Check if we have any short positions that become liquidatable (anywhere on the curve)
  const hasShortLiquidations = curveData.some(p => p.shortLiquidatableCount > 0);
  const hasLongLiquidations = curveData.some(p => p.longLiquidatableCount > 0);

  // Handle mouse events for click/drag
  const getMousePct = (e: React.MouseEvent<SVGSVGElement>): number => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 600;
    let pct = xScaleInverse(x);
    pct = Math.max(-50, Math.min(20, pct));
    // Snap to nearest 2
    return Math.round(pct / 2) * 2;
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const pct = getMousePct(e);
    setIsDragging(true);
    setDragStart(pct);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const pct = getMousePct(e);
    setHoveredPct(pct);
    
    if (isDragging && dragStart !== null) {
      const minPct = Math.min(dragStart, pct);
      const maxPct = Math.max(dragStart, pct);
      if (Math.abs(maxPct - minPct) >= 4) {
        setRange({ min: minPct, max: maxPct });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    const pct = getMousePct(e);
    
    if (dragStart !== null && Math.abs(pct - dragStart) < 4) {
      // Click - select single point
      activateScenario(pct);
      setRange(null);
    }
    
    setIsDragging(false);
    setDragStart(null);
  };

  const handleMouseLeave = () => {
    setHoveredPct(null);
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
    }
  };

  // Preset buttons
  const presets = [-30, -20, -10, 0, 10, 20];

  if (isLoading && positions.length === 0) {
    return (
      <div className="surface-card p-4">
        <div className="h-[180px] bg-white/[0.03] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="surface-card p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Stress Curve</h3>
        <p className="text-xs text-white/40">No positions to analyze</p>
      </div>
    );
  }

  return (
    <div className="surface-card p-4 overflow-hidden">
      {/* Header - display only, controls are in RiskPanel */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-white/70 uppercase tracking-wide">
            Stress Curve
          </h3>
          <span className="text-[10px] text-white/30 hidden sm:inline">Click chart to select shock</span>
        </div>
        
        {/* Current scenario indicator (display only) */}
        {isActive && shockPct !== 0 && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-white/40">Viewing:</span>
            <span className="px-2 py-0.5 rounded bg-white/[0.08] text-white/80 font-medium tabular-nums">
              {shockPct > 0 ? '+' : ''}{shockPct}%
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 600 ${chartHeight}`}
          className="w-full cursor-crosshair"
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Subtle teal area fill */}
            <linearGradient id="debtAreaGradientInteractive" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
            </linearGradient>
            {/* Selected range */}
            <linearGradient id="selectedRangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Weekly volatility band */}
          <rect
            x={xScale(-weeklyMove)}
            y={paddingTop}
            width={xScale(weeklyMove) - xScale(-weeklyMove)}
            height={innerHeight}
            fill="rgba(255,255,255,0.02)"
            rx="4"
          />
          
          {/* Daily volatility band */}
          <rect
            x={xScale(-dailyMove)}
            y={paddingTop}
            width={xScale(dailyMove) - xScale(-dailyMove)}
            height={innerHeight}
            fill="rgba(255,255,255,0.02)"
            rx="2"
          />

          {/* Selected range highlight */}
          {range && (
            <rect
              x={xScale(range.min)}
              y={paddingTop}
              width={xScale(range.max) - xScale(range.min)}
              height={innerHeight}
              fill="url(#selectedRangeGradient)"
              stroke="#f59e0b"
              strokeWidth="1"
              strokeOpacity="0.3"
              rx="4"
            />
          )}

          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => (
            <line
              key={ratio}
              x1={paddingLeft}
              y1={paddingTop + innerHeight * (1 - ratio)}
              x2={paddingLeft + innerWidth}
              y2={paddingTop + innerHeight * (1 - ratio)}
              stroke="white"
              strokeOpacity="0.04"
            />
          ))}

          {/* Current scenario vertical line (0%) */}
          <line
            x1={xScale(0)}
            y1={paddingTop}
            x2={xScale(0)}
            y2={paddingTop + innerHeight}
            stroke="#10b981"
            strokeWidth="1"
            strokeOpacity="0.4"
            strokeDasharray="3,4"
          />

          {/* Area under debt curve */}
          <path 
            d={debtAreaD} 
            fill="url(#debtAreaGradientInteractive)" 
            opacity={isActive && shockPct !== 0 ? 1 : 0.5}
          />

          {/* Debt line - muted teal, more visible when scenario active */}
          <path
            d={debtPathD}
            fill="none"
            stroke="#5eead4"
            strokeWidth={isActive && shockPct !== 0 ? 2 : 1.5}
            strokeOpacity={isActive && shockPct !== 0 ? 0.8 : 0.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Count line - muted amber, more visible when scenario active */}
          <path
            d={countPathD}
            fill="none"
            stroke="#fcd34d"
            strokeWidth={isActive && shockPct !== 0 ? 2 : 1.5}
            strokeOpacity={isActive && shockPct !== 0 ? 0.7 : 0.35}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* LONG positions line - cyan, hurt by price drops */}
          {hasLongLiquidations && (
            <path
              d={longCountPathD}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={1}
              strokeOpacity={0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4,3"
            />
          )}
          
          {/* SHORT positions line - violet, hurt by price increases */}
          {hasShortLiquidations && (
            <path
              d={shortCountPathD}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={1}
              strokeOpacity={0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4,3"
            />
          )}

          {/* Selected shock line */}
          {isActive && shockPct !== 0 && (
            <>
              <line
                x1={xScale(shockPct)}
                y1={paddingTop}
                x2={xScale(shockPct)}
                y2={paddingTop + innerHeight}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeOpacity="0.5"
              />
              <circle
                cx={xScale(shockPct)}
                cy={yScaleCount(selectedPoint.liquidatableCount)}
                r="4"
                fill="#fcd34d"
                fillOpacity="0.9"
                stroke="#0d1a1f"
                strokeWidth="1.5"
              />
              <circle
                cx={xScale(shockPct)}
                cy={yScaleDebt(selectedPoint.debtAtRiskUsd)}
                r="4"
                fill="#5eead4"
                fillOpacity="0.9"
                stroke="#0d1a1f"
                strokeWidth="1.5"
              />
              <text
                x={xScale(shockPct)}
                y={paddingTop - 6}
                textAnchor="middle"
                className="text-[9px] font-medium"
                fill="#f59e0b"
                fillOpacity="0.8"
              >
                {shockPct > 0 ? '+' : ''}{shockPct}%
              </text>
            </>
          )}

          {/* Hover indicator */}
          {hoveredPct !== null && !isActive && (
            <line
              x1={xScale(hoveredPct)}
              y1={paddingTop}
              x2={xScale(hoveredPct)}
              y2={paddingTop + innerHeight}
              stroke="white"
              strokeWidth="1"
              strokeOpacity="0.3"
              strokeDasharray="2,2"
            />
          )}

          {/* Cliff marker */}
          {cliffPoint && (
            <circle
              cx={xScale(cliffPoint.pct)}
              cy={yScaleDebt(cliffPoint.debtAfter)}
              r="3"
              fill="rgba(255,255,255,0.8)"
              stroke="rgba(15, 23, 42, 0.6)"
              strokeWidth="1"
            />
          )}

          {/* X-axis labels */}
          {[-50, -30, -20, -10, 0, 10, 20].map((pct) => (
            <text
              key={pct}
              x={xScale(pct)}
              y={paddingTop + innerHeight + 14}
              textAnchor="middle"
              className="text-[8px]"
              fill={pct === 0 ? '#10b981' : 'rgba(255,255,255,0.35)'}
              fillOpacity={pct === 0 ? 0.7 : 1}
            >
              {pct > 0 ? '+' : ''}{pct}%
            </text>
          ))}

          {/* Y-axis labels - Left (Positions) */}
          <text
            x={paddingLeft - 6}
            y={paddingTop}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-[8px]"
            fill="#fcd34d"
            fillOpacity="0.6"
          >
            {maxLiquidatable}
          </text>
          <text
            x={paddingLeft - 6}
            y={paddingTop + innerHeight}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-[8px]"
            fill="rgba(255,255,255,0.3)"
          >
            0
          </text>
          <text
            x={8}
            y={paddingTop + innerHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[7px] uppercase tracking-wider"
            fill="#fcd34d"
            fillOpacity="0.5"
            transform={`rotate(-90, 8, ${paddingTop + innerHeight / 2})`}
          >
            Positions
          </text>
          
          {/* Y-axis labels - Right (Debt) */}
          <text
            x={paddingLeft + innerWidth + 6}
            y={paddingTop}
            textAnchor="start"
            dominantBaseline="middle"
            className="text-[8px]"
            fill="#5eead4"
            fillOpacity="0.6"
          >
            {formatUsd(maxDebt)}
          </text>
          <text
            x={paddingLeft + innerWidth + 6}
            y={paddingTop + innerHeight}
            textAnchor="start"
            dominantBaseline="middle"
            className="text-[8px]"
            fill="rgba(255,255,255,0.3)"
          >
            $0
          </text>
          <text
            x={592}
            y={paddingTop + innerHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[7px] uppercase tracking-wider"
            fill="#5eead4"
            fillOpacity="0.5"
            transform={`rotate(90, 592, ${paddingTop + innerHeight / 2})`}
          >
            Debt at Risk
          </text>
        </svg>
      </div>

      {/* Legend and stats */}
      <div className="flex items-center justify-between mt-3 text-[10px] gap-2 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded-full" style={{ background: '#fcd34d', opacity: 0.6 }} />
            <span className="text-white/40"># Positions</span>
          </span>
          {hasLongLiquidations && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 rounded-full border border-dashed border-cyan-400" />
              <span className="text-cyan-400/60">Long</span>
            </span>
          )}
          {hasShortLiquidations && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 rounded-full border border-dashed border-violet-400" />
              <span className="text-violet-400/60">Short</span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded-full" style={{ background: '#5eead4', opacity: 0.7 }} />
            <span className="text-white/40">$ Debt</span>
          </span>
        </div>
        
        {/* Direction breakdown */}
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-white/30">Positions:</span>
          <span className="text-cyan-400/70">
            <span className="font-medium">{directionStats.long}</span> Long
          </span>
          <span className="text-violet-400/70">
            <span className="font-medium">{directionStats.short}</span> Short
          </span>
        </div>
      </div>
      
      {/* Scenario stats row */}
      {range ? (
        <div className="mt-2 text-[10px] text-amber-400/70">
          Range: {range.min}% to {range.max}%
        </div>
      ) : isActive && shockPct !== 0 ? (
        <div className="mt-2 text-[10px] text-white/50">
          At {shockPct > 0 ? '+' : ''}{shockPct}%: 
          <span className="text-amber-300/80 ml-1">{selectedPoint.liquidatableCount} positions</span>
          {selectedPoint.longLiquidatableCount > 0 && (
            <span className="text-cyan-400/70 ml-1">({selectedPoint.longLiquidatableCount} long)</span>
          )}
          {selectedPoint.shortLiquidatableCount > 0 && (
            <span className="text-violet-400/70 ml-1">({selectedPoint.shortLiquidatableCount} short)</span>
          )}
          <span className="text-teal-300/80 ml-2">{formatUsd(selectedPoint.debtAtRiskUsd)}</span>
        </div>
      ) : cliffPoint ? (
        <div className="mt-2 text-[10px] text-white/35">
          Cliff at {cliffPoint.pct}%: debt jumps {cliffPoint.multiplier.toFixed(1)}×
        </div>
      ) : null}
    </div>
  );
}
