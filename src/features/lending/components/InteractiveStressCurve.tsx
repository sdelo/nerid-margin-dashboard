import React from 'react';
import { type AtRiskPosition } from '../../../hooks/useAtRiskPositions';
import { useScenario, type ShockAsset, simulateAllPositions } from '../../../context/ScenarioContext';

interface InteractiveStressCurveProps {
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
  priceChangePct: number,
  shockAsset: ShockAsset
): { liquidatableCount: number; debtAtRiskUsd: number } {
  let liquidatableCount = 0;
  let debtAtRiskUsd = 0;

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
    }
  });

  return { liquidatableCount, debtAtRiskUsd };
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
      });
    }
    return points;
  }, [positions, shockAsset]);

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

  // Area path for debt
  const debtAreaD =
    debtPathD +
    ` L ${xScale(20)} ${paddingTop + innerHeight} L ${xScale(-50)} ${paddingTop + innerHeight} Z`;

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
      <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-4">
        <div className="h-[180px] bg-white/[0.03] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Stress Curve</h3>
        <p className="text-xs text-white/40">No positions to analyze</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-4">
      {/* Header with presets */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            Stress Curve
          </h3>
          <span className="text-[10px] text-white/40">Click to select shock · Drag to select range</span>
        </div>
        
        {/* Preset buttons */}
        <div className="flex items-center gap-1">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => activateScenario(preset)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
                shockPct === preset && isActive
                  ? 'bg-teal-500 text-slate-900'
                  : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/15'
              }`}
            >
              {preset > 0 ? '+' : ''}{preset}%
            </button>
          ))}
          {isActive && (
            <button
              onClick={resetScenario}
              className="px-2 py-1 text-[10px] font-medium rounded bg-white/5 text-white/50 hover:text-white hover:bg-white/10 ml-1"
            >
              Reset
            </button>
          )}
        </div>
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
            <linearGradient id="debtAreaGradientInteractive" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="selectedRangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Weekly volatility band */}
          <rect
            x={xScale(-weeklyMove)}
            y={paddingTop}
            width={xScale(weeklyMove) - xScale(-weeklyMove)}
            height={innerHeight}
            fill="rgba(255,255,255,0.03)"
            rx="4"
          />
          
          {/* Daily volatility band */}
          <rect
            x={xScale(-dailyMove)}
            y={paddingTop}
            width={xScale(dailyMove) - xScale(-dailyMove)}
            height={innerHeight}
            fill="rgba(255,255,255,0.03)"
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
              stroke="#f43f5e"
              strokeWidth="1"
              strokeOpacity="0.5"
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
            strokeWidth="1.5"
            strokeDasharray="3,3"
          />

          {/* Area under debt curve */}
          <path d={debtAreaD} fill="url(#debtAreaGradientInteractive)" />

          {/* Debt line */}
          <path
            d={debtPathD}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Count line */}
          <path
            d={countPathD}
            fill="none"
            stroke="#fb7185"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Selected shock line */}
          {isActive && shockPct !== 0 && (
            <>
              <line
                x1={xScale(shockPct)}
                y1={paddingTop}
                x2={xScale(shockPct)}
                y2={paddingTop + innerHeight}
                stroke="#f43f5e"
                strokeWidth="2"
              />
              <circle
                cx={xScale(shockPct)}
                cy={yScaleCount(selectedPoint.liquidatableCount)}
                r="5"
                fill="#fb7185"
                stroke="white"
                strokeWidth="2"
              />
              <circle
                cx={xScale(shockPct)}
                cy={yScaleDebt(selectedPoint.debtAtRiskUsd)}
                r="5"
                fill="#22d3ee"
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={xScale(shockPct)}
                y={paddingTop - 6}
                textAnchor="middle"
                className="fill-rose-400 text-[9px] font-bold"
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
              r="4"
              fill="#f43f5e"
              stroke="white"
              strokeWidth="1.5"
            />
          )}

          {/* X-axis labels */}
          {[-50, -30, -20, -10, 0, 10, 20].map((pct) => (
            <text
              key={pct}
              x={xScale(pct)}
              y={paddingTop + innerHeight + 14}
              textAnchor="middle"
              className={`text-[8px] ${pct === 0 ? 'fill-emerald-400 font-bold' : 'fill-white/40'}`}
            >
              {pct > 0 ? '+' : ''}{pct}%
            </text>
          ))}

          {/* Y-axis labels */}
          <text
            x={paddingLeft - 6}
            y={paddingTop}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-rose-400 text-[8px]"
          >
            {maxLiquidatable}
          </text>
          <text
            x={paddingLeft + innerWidth + 6}
            y={paddingTop}
            textAnchor="start"
            dominantBaseline="middle"
            className="fill-cyan-400 text-[8px]"
          >
            {formatUsd(maxDebt)}
          </text>
        </svg>
      </div>

      {/* Legend and stats */}
      <div className="flex items-center justify-between mt-2 text-[10px] gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-white/50">
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-rose-400 rounded" />
            # Positions
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-cyan-400 rounded" />
            $ Debt
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-emerald-500 rounded" />
            Now
          </span>
        </div>
        
        {range ? (
          <span className="text-rose-300">
            Range: {range.min}% to {range.max}%
          </span>
        ) : isActive ? (
          <span className="text-white/60">
            At {shockPct}%: <span className="text-rose-400">{selectedPoint.liquidatableCount} positions</span>
            {' · '}<span className="text-cyan-400">{formatUsd(selectedPoint.debtAtRiskUsd)}</span>
          </span>
        ) : cliffPoint ? (
          <span className="text-white/40">
            Cliff at {cliffPoint.pct}%: debt jumps {cliffPoint.multiplier.toFixed(1)}×
          </span>
        ) : null}
      </div>
    </div>
  );
}
