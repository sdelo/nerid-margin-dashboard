import React from 'react';
import { type AtRiskPosition, getDirectionCounts } from '../../../hooks/useAtRiskPositions';
import { InteractiveStressCurve } from './InteractiveStressCurve';
import { useScenario, simulatePositionAtShock, type ShockAsset } from '../../../context/ScenarioContext';

interface RiskPanelProps {
  positions: AtRiskPosition[];
  isLoading: boolean;
  onFilterChange?: (filter: RiskFilter) => void;
  activeFilter?: RiskFilter;
}

export type RiskFilter = 'all' | 'liquidatable' | 'critical' | 'watch' | 'safe';

interface StatusCounts {
  liquidatable: number;
  critical: number;
  watch: number;
  safe: number;
  total: number;
}

function getStatusCounts(positions: AtRiskPosition[]): StatusCounts {
  return {
    liquidatable: positions.filter(p => p.isLiquidatable).length,
    critical: positions.filter(p => !p.isLiquidatable && p.distanceToLiquidation < 10).length,
    watch: positions.filter(p => !p.isLiquidatable && p.distanceToLiquidation >= 10 && p.distanceToLiquidation < 30).length,
    safe: positions.filter(p => !p.isLiquidatable && p.distanceToLiquidation >= 30).length,
    total: positions.length,
  };
}

function getShockedStatusCounts(
  positions: AtRiskPosition[],
  shockPct: number,
  shockAsset: ShockAsset
): StatusCounts & { debtAtRisk: number } {
  let liquidatable = 0;
  let critical = 0;
  let watch = 0;
  let safe = 0;
  let debtAtRisk = 0;

  positions.forEach(p => {
    const sim = simulatePositionAtShock(p, shockPct, shockAsset);
    if (sim.wouldLiquidate) {
      liquidatable++;
      debtAtRisk += p.totalDebtUsd;
    } else if (sim.simulatedBuffer < 10) {
      critical++;
    } else if (sim.simulatedBuffer < 30) {
      watch++;
    } else {
      safe++;
    }
  });

  return { liquidatable, critical, watch, safe, total: positions.length, debtAtRisk };
}

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Scenario Summary Strip - Key metrics when scenario is active
 */
function ScenarioSummaryStrip({
  positions,
  shockedCounts,
  shockPct,
  shockAsset,
}: {
  positions: AtRiskPosition[];
  shockedCounts: StatusCounts & { debtAtRisk: number };
  shockPct: number;
  shockAsset: ShockAsset;
}) {
  const nowCounts = getStatusCounts(positions);
  const { resetScenario } = useScenario();
  
  // Find closest buffer among non-liquidated positions
  const closestBuffer = React.useMemo(() => {
    let minBuffer = Infinity;
    positions.forEach(p => {
      const sim = simulatePositionAtShock(p, shockPct, shockAsset);
      if (!sim.wouldLiquidate && sim.simulatedBuffer < minBuffer) {
        minBuffer = sim.simulatedBuffer;
      }
    });
    return minBuffer === Infinity ? null : minBuffer;
  }, [positions, shockPct, shockAsset]);

  const newLiquidations = shockedCounts.liquidatable - nowCounts.liquidatable;

  return (
    <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.04]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Scenario label */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Scenario</span>
          <span className="text-xs font-semibold text-white">
            {shockAsset} {shockPct > 0 ? '+' : ''}{shockPct}%
          </span>
          <button
            onClick={resetScenario}
            className="text-[10px] text-teal-400 hover:text-teal-300 transition-colors ml-1"
          >
            Reset
          </button>
        </div>

        {/* Summary metrics */}
        <div className="flex items-center gap-5">
          {/* Would Liquidate */}
          <div className="text-right">
            <div className="text-[9px] text-white/40 uppercase tracking-wider">At Risk</div>
            <div className={`text-sm font-bold tabular-nums ${shockedCounts.liquidatable > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {shockedCounts.liquidatable}
              {newLiquidations > 0 && (
                <span className="text-[10px] text-rose-300 ml-1">(+{newLiquidations})</span>
              )}
            </div>
          </div>

          {/* Critical */}
          <div className="text-right">
            <div className="text-[9px] text-white/40 uppercase tracking-wider">Critical</div>
            <div className={`text-sm font-bold tabular-nums ${shockedCounts.critical > 0 ? 'text-amber-400' : 'text-white/60'}`}>
              {shockedCounts.critical}
            </div>
          </div>

          {/* Debt at Risk */}
          <div className="text-right">
            <div className="text-[9px] text-white/40 uppercase tracking-wider">Debt at Risk</div>
            <div className="text-sm font-bold tabular-nums text-teal-400">
              {formatUsd(shockedCounts.debtAtRisk)}
            </div>
          </div>

          {/* Closest Buffer */}
          {closestBuffer !== null && (
            <div className="text-right">
              <div className="text-[9px] text-white/40 uppercase tracking-wider">Min Buffer</div>
              <div className={`text-sm font-bold tabular-nums ${
                closestBuffer < 10 ? 'text-amber-400' : 
                closestBuffer < 30 ? 'text-teal-400' : 'text-emerald-400'
              }`}>
                {closestBuffer.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Buffer Distribution Strip - Horizontal stacked bar showing risk distribution
 * Clickable segments filter the table below
 */
function BufferDistributionStrip({
  positions,
  onFilterChange,
  activeFilter,
  shockedCounts,
}: {
  positions: AtRiskPosition[];
  onFilterChange?: (filter: RiskFilter) => void;
  activeFilter?: RiskFilter;
  shockedCounts?: StatusCounts & { debtAtRisk: number };
}) {
  const counts = getStatusCounts(positions);
  const total = counts.total || 1;

  // Use shocked counts for display if available
  const displayCounts = shockedCounts || counts;

  // Calculate debt by status (current state)
  const debtByStatus = React.useMemo(() => {
    const result = { liquidatable: 0, critical: 0, watch: 0, safe: 0 };
    positions.forEach(p => {
      const debt = p.totalDebtUsd;
      if (p.isLiquidatable) result.liquidatable += debt;
      else if (p.distanceToLiquidation < 10) result.critical += debt;
      else if (p.distanceToLiquidation < 30) result.watch += debt;
      else result.safe += debt;
    });
    return result;
  }, [positions]);

  const totalDebt = Object.values(debtByStatus).reduce((a, b) => a + b, 0) || 1;

  const segments = [
    { 
      key: 'safe' as const,
      label: 'Safe', 
      count: displayCounts.safe,
      originalCount: counts.safe,
      pct: (displayCounts.safe / total) * 100,
      color: 'bg-emerald-500',
      hoverColor: 'hover:bg-emerald-400',
      textColor: 'text-emerald-400',
    },
    { 
      key: 'watch' as const,
      label: 'Watch', 
      count: displayCounts.watch,
      originalCount: counts.watch,
      pct: (displayCounts.watch / total) * 100,
      color: 'bg-teal-500',
      hoverColor: 'hover:bg-teal-400',
      textColor: 'text-teal-400',
    },
    { 
      key: 'critical' as const,
      label: 'Critical', 
      count: displayCounts.critical,
      originalCount: counts.critical,
      pct: (displayCounts.critical / total) * 100,
      color: 'bg-amber-500',
      hoverColor: 'hover:bg-amber-400',
      textColor: 'text-amber-400',
    },
    { 
      key: 'liquidatable' as const,
      label: 'Liq', 
      count: displayCounts.liquidatable,
      originalCount: counts.liquidatable,
      pct: (displayCounts.liquidatable / total) * 100,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-400',
      textColor: 'text-orange-400',
    },
  ];

  const visibleSegments = segments.filter(s => s.count > 0);
  const isShocked = shockedCounts !== undefined;

  return (
    <div className="space-y-2">
      {/* Stacked bar chart */}
      <div className="relative h-8 flex rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.06]">
        {visibleSegments.length > 0 ? visibleSegments.map((seg) => (
          <button
            key={seg.key}
            onClick={() => onFilterChange?.(activeFilter === seg.key ? 'all' : seg.key)}
            className={`relative h-full transition-all group ${seg.color} ${seg.hoverColor} ${
              activeFilter === seg.key 
                ? 'ring-2 ring-white/40 ring-inset z-10' 
                : activeFilter && activeFilter !== 'all'
                  ? 'opacity-50'
                  : ''
            }`}
            style={{ width: `${Math.max(seg.pct, seg.count > 0 ? 4 : 0)}%` }}
            title={`${seg.label}: ${seg.count} positions`}
          >
            {/* Segment label */}
            {seg.pct > 10 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-900/80 drop-shadow-sm">
                  {seg.count}
                </span>
              </div>
            )}
            
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
              <div className="bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-[10px] whitespace-nowrap shadow-xl">
                <div className="font-semibold text-white">{seg.label}</div>
                <div className={seg.textColor}>{seg.count} positions</div>
                {isShocked && seg.count !== seg.originalCount && (
                  <div className="text-white/40 mt-1">
                    Was: {seg.originalCount}
                  </div>
                )}
                <div className="text-white/30 mt-1">Click to filter</div>
              </div>
            </div>
          </button>
        )) : (
          <div className="flex-1 flex items-center justify-center text-white/30 text-xs">
            No positions
          </div>
        )}
      </div>

      {/* Legend row */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-4">
          {segments.map(seg => (
            <button
              key={seg.key}
              onClick={() => onFilterChange?.(activeFilter === seg.key ? 'all' : seg.key)}
              className={`flex items-center gap-1.5 transition-all ${
                activeFilter === seg.key 
                  ? 'opacity-100' 
                  : activeFilter && activeFilter !== 'all' 
                    ? 'opacity-40 hover:opacity-70' 
                    : 'opacity-100 hover:opacity-80'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${seg.color}`} />
              <span className="text-white/50">{seg.label}</span>
              <span className={`font-bold tabular-nums ${seg.textColor}`}>{seg.count}</span>
              {isShocked && seg.count !== seg.originalCount && (
                <span className={`tabular-nums ${seg.count > seg.originalCount ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ({seg.count > seg.originalCount ? '+' : ''}{seg.count - seg.originalCount})
                </span>
              )}
            </button>
          ))}
        </div>
        {activeFilter && activeFilter !== 'all' && (
          <button
            onClick={() => onFilterChange?.('all')}
            className="text-teal-400 hover:text-teal-300 transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Shock Controls - Inline asset selector and shock slider
 */
function ShockControls({
  positions,
}: {
  positions: AtRiskPosition[];
}) {
  const { shockAsset, shockPct, isActive, activateScenario, setShockAsset, resetScenario } = useScenario();

  // Get available assets from positions
  const availableAssets = React.useMemo(() => {
    const assets = new Set<string>();
    positions.forEach(p => {
      if (p.baseAssetSymbol) assets.add(p.baseAssetSymbol);
    });
    return ['ALL', ...Array.from(assets)] as ShockAsset[];
  }, [positions]);

  const presets = [-30, -20, -10, 0, 10];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Asset selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Shock</span>
        <div className="flex bg-white/[0.04] rounded-md p-0.5 border border-white/[0.06]">
          {availableAssets.slice(0, 4).map(asset => (
            <button
              key={asset}
              onClick={() => {
                setShockAsset(asset);
                if (!isActive) activateScenario(shockPct || -10);
              }}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
                shockAsset === asset && isActive
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {asset}
            </button>
          ))}
        </div>
      </div>

      {/* Shock percentage presets */}
      <div className="flex items-center gap-1">
        {presets.map(pct => (
          <button
            key={pct}
            onClick={() => pct === 0 ? resetScenario() : activateScenario(pct)}
            className={`px-2 py-1 text-[10px] rounded transition-all ${
              shockPct === pct && (pct === 0 ? !isActive : isActive)
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
            }`}
          >
            {pct === 0 ? 'Now' : `${pct > 0 ? '+' : ''}${pct}%`}
          </button>
        ))}
      </div>

      {/* Reset button */}
      {isActive && shockPct !== 0 && (
        <button
          onClick={resetScenario}
          className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}

/**
 * Shock Preview - Shows impact summary when shock is active
 */
function ShockPreview({
  positions,
  shockedCounts,
  onClick,
}: {
  positions: AtRiskPosition[];
  shockedCounts: StatusCounts & { debtAtRisk: number };
  onClick?: () => void;
}) {
  const { shockPct, shockAsset } = useScenario();
  const nowCounts = getStatusCounts(positions);

  const newLiquidations = shockedCounts.liquidatable - nowCounts.liquidatable;
  const newCritical = shockedCounts.critical - nowCounts.critical;

  return (
    <button
      onClick={onClick}
      className="w-full mt-3 p-3 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 
                 transition-all group cursor-pointer text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            <span className="text-xs text-rose-300">
              At <span className="font-bold">{shockPct > 0 ? '+' : ''}{shockPct}% {shockAsset}</span>
            </span>
          </div>
          
          <span className="text-white/30">→</span>
          
          <div className="flex items-center gap-3 text-xs">
            {newLiquidations > 0 && (
              <span className="text-orange-400">
                <span className="font-bold">+{newLiquidations}</span> at risk
              </span>
            )}
            {newCritical > 0 && (
              <span className="text-amber-400">
                <span className="font-bold">+{newCritical}</span> critical
              </span>
            )}
            {shockedCounts.debtAtRisk > 0 && (
              <span className="text-white/50">
                <span className="font-medium text-rose-300">{formatUsd(shockedCounts.debtAtRisk)}</span> at risk
              </span>
            )}
            {newLiquidations === 0 && newCritical === 0 && (
              <span className="text-emerald-400">
                All positions remain safe
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-white/30 group-hover:text-white/50 transition-colors">
          <span className="text-[10px]">View stress curve</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

/**
 * Risk Panel - Unified risk visualization module
 * 
 * Always shows:
 * - Shock controls (asset selector + shock presets)
 * - Risk distribution bar
 * - Shock preview (when shock ≠ 0)
 * 
 * Expandable:
 * - Full stress curve chart
 */
export function RiskPanel({
  positions,
  isLoading,
  onFilterChange,
  activeFilter,
}: RiskPanelProps) {
  const { isActive, shockPct, shockAsset } = useScenario();
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Auto-expand when shock is active, collapse when back to "Now"
  React.useEffect(() => {
    if (isActive && shockPct !== 0) {
      setIsExpanded(true);
    }
  }, [isActive, shockPct]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Calculate shocked counts when scenario is active
  const shockedCounts = React.useMemo(() => {
    if (!isActive || shockPct === 0) return undefined;
    return getShockedStatusCounts(positions, shockPct, shockAsset);
  }, [positions, isActive, shockPct, shockAsset]);
  
  // Calculate direction breakdown
  const directionCounts = React.useMemo(() => {
    return getDirectionCounts(positions);
  }, [positions]);

  if (isLoading && positions.length === 0) {
    return (
      <div className="surface-card p-4">
        <div className="h-24 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="surface-card overflow-hidden">
      {/* Header with controls */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs font-medium text-white/70 uppercase tracking-wide">
              Risk Distribution
            </span>
            
            {/* Direction breakdown badges */}
            <div className="flex items-center gap-2 ml-2">
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-cyan-500/15 text-cyan-400 flex items-center gap-1" title="Long positions - hurt by price drops">
                <span>↗</span>
                <span className="font-medium">{directionCounts.long}</span>
              </span>
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-violet-500/15 text-violet-400 flex items-center gap-1" title="Short positions - benefit from price drops">
                <span>↘</span>
                <span className="font-medium">{directionCounts.short}</span>
              </span>
            </div>
          </div>
          
          <ShockControls positions={positions} />
        </div>
      </div>

      {/* Scenario summary strip - shows when shock is active */}
      {isActive && shockPct !== 0 && shockedCounts && (
        <ScenarioSummaryStrip 
          positions={positions}
          shockedCounts={shockedCounts}
          shockPct={shockPct}
          shockAsset={shockAsset}
        />
      )}

      {/* Distribution bar - always visible */}
      <div className="px-4 py-3">
        <BufferDistributionStrip 
          positions={positions}
          onFilterChange={onFilterChange}
          activeFilter={activeFilter}
          shockedCounts={shockedCounts}
        />
      </div>


      {/* Expand/Collapse button */}
      <button
        onClick={toggleExpanded}
        className="w-full px-4 py-2 flex items-center justify-center gap-2 
                   text-white/30 hover:text-white/50 hover:bg-white/[0.02] 
                   border-t border-white/[0.04] transition-colors"
      >
        <span className="text-[10px]">
          {isExpanded ? 'Hide stress curve' : 'Show stress curve'}
        </span>
        <svg 
          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable stress curve */}
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-white/[0.04]">
          <InteractiveStressCurve positions={positions} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

export type { RiskPanelProps };
