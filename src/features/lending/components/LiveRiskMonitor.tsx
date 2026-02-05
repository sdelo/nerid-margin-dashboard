import React from 'react';
import { type AtRiskPosition, getPositionDirection, type PositionDirection } from '../../../hooks/useAtRiskPositions';
import { useScenario, simulatePositionAtShock, type SimulatedPosition } from '../../../context/ScenarioContext';
import { RiskPanel, type RiskFilter } from './RiskPanel';
import { InfoTooltip } from '../../../components/InfoTooltip';

interface LiveRiskMonitorProps {
  positions: AtRiskPosition[];
  isLoading: boolean;
  onLiquidate: (position: AtRiskPosition) => void;
  lastUpdated: Date | null;
}

type SortField = 'buffer' | 'debt' | 'collateral' | 'reward' | 'pair' | 'scenarioBuffer';
type SortDirection = 'asc' | 'desc';

type RiskBand = 'liquidatable' | 'critical' | 'warning' | 'watch' | 'safe';

/**
 * Get risk band based on position state
 */
function getRiskBand(position: AtRiskPosition): RiskBand {
  if (position.isLiquidatable) return 'liquidatable';
  if (position.distanceToLiquidation < 5) return 'critical';
  if (position.distanceToLiquidation < 15) return 'warning';
  if (position.distanceToLiquidation < 30) return 'watch';
  return 'safe';
}

/**
 * Get status badge styling
 */
function getStatusBadge(band: RiskBand): { label: string; bgColor: string; textColor: string; borderColor: string } {
  switch (band) {
    case 'liquidatable':
      return {
        label: 'AT RISK',
        bgColor: 'bg-orange-500',
        textColor: 'text-white',
        borderColor: 'border-orange-400',
      };
    case 'critical':
      return {
        label: 'CRITICAL',
        bgColor: 'bg-rose-500/20',
        textColor: 'text-rose-300',
        borderColor: 'border-rose-500/40',
      };
    case 'warning':
      return {
        label: 'WARNING',
        bgColor: 'bg-amber-500/20',
        textColor: 'text-amber-300',
        borderColor: 'border-amber-500/40',
      };
    case 'watch':
      return {
        label: 'WATCH',
        bgColor: 'bg-teal-500/20',
        textColor: 'text-teal-300',
        borderColor: 'border-teal-500/40',
      };
    case 'safe':
      return {
        label: 'SAFE',
        bgColor: 'bg-emerald-500/20',
        textColor: 'text-emerald-300',
        borderColor: 'border-emerald-500/30',
      };
  }
}

/**
 * Get scenario impact badge
 */
function getImpactBadge(impact: 'SAFE' | 'WATCH' | 'LIQ'): { label: string; bgColor: string; textColor: string } {
  switch (impact) {
    case 'LIQ':
      return { label: 'LIQ', bgColor: 'bg-rose-500', textColor: 'text-white' };
    case 'WATCH':
      return { label: 'WATCH', bgColor: 'bg-amber-500/30', textColor: 'text-amber-300' };
    case 'SAFE':
      return { label: 'SAFE', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-300' };
  }
}

/**
 * Get direction badge styling
 */
function getDirectionBadge(direction: PositionDirection): { 
  label: string; 
  icon: string;
  bgColor: string; 
  textColor: string;
  tooltip: string;
} {
  switch (direction) {
    case 'LONG':
      return { 
        label: 'LONG', 
        icon: '↗',
        bgColor: 'bg-cyan-500/15', 
        textColor: 'text-cyan-400',
        tooltip: 'Hurts when price drops',
      };
    case 'SHORT':
      return { 
        label: 'SHORT', 
        icon: '↘',
        bgColor: 'bg-violet-500/15', 
        textColor: 'text-violet-400',
        tooltip: 'Benefits when price drops',
      };
  }
}

function formatAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  if (value < 1 && value > 0) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(0)}`;
}

function calculateNetProfit(position: AtRiskPosition): number {
  const grossReward = position.estimatedRewardUsd;
  const estimatedGasCost = 0.50;
  const estimatedSlippage = position.totalDebtUsd * 0.003;
  return grossReward - estimatedGasCost - estimatedSlippage;
}

interface PositionWithScenario extends AtRiskPosition {
  scenario: SimulatedPosition | null;
}

/**
 * Live Risk Monitor - Sortable margin manager table with scenario mode
 */
const ITEMS_PER_PAGE = 15;

export function LiveRiskMonitor({
  positions,
  isLoading,
  onLiquidate,
  lastUpdated,
}: LiveRiskMonitorProps) {
  const { isActive, shockAsset, shockPct, range, resetScenario } = useScenario();
  const [sortField, setSortField] = React.useState<SortField>('buffer');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const [filterMode, setFilterMode] = React.useState<RiskFilter>('all');
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [currentPage, setCurrentPage] = React.useState<number>(1);

  // Calculate scenario for each position
  const positionsWithScenario = React.useMemo((): PositionWithScenario[] => {
    return positions.map(position => ({
      ...position,
      scenario: isActive && shockPct !== 0
        ? simulatePositionAtShock(position, shockPct, shockAsset)
        : null,
    }));
  }, [positions, isActive, shockPct, shockAsset]);

  // Filter positions based on mode and scenario
  const filteredPositions = React.useMemo(() => {
    let filtered = positionsWithScenario;

    // Search filter - match against position ID (marginManagerId)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.marginManagerId.toLowerCase().includes(query)
      );
    }

    // Range filter
    if (range && isActive) {
      filtered = filtered.filter(p => {
        if (!p.scenario) return true;
        // Check if position liquidates within the range
        for (let pct = range.min; pct <= range.max; pct += 2) {
          const sim = simulatePositionAtShock(p, pct, shockAsset);
          if (sim.wouldLiquidate) return true;
        }
        return false;
      });
    }

    // Status filter
    switch (filterMode) {
      case 'liquidatable':
        // When scenario is active, show positions that would be liquidatable at the shock
        if (isActive && shockPct !== 0) {
          return filtered.filter(p => p.scenario?.wouldLiquidate);
        }
        return filtered.filter(p => p.isLiquidatable);
      case 'critical':
        return filtered.filter(p => !p.isLiquidatable && p.distanceToLiquidation < 10);
      case 'watch':
        return filtered.filter(p => !p.isLiquidatable && p.distanceToLiquidation >= 10 && p.distanceToLiquidation < 30);
      case 'safe':
        return filtered.filter(p => !p.isLiquidatable && p.distanceToLiquidation >= 30);
      default:
        return filtered;
    }
  }, [positionsWithScenario, filterMode, range, isActive, shockAsset, shockPct, searchQuery]);

  // Sort positions
  const sortedPositions = React.useMemo(() => {
    const sorted = [...filteredPositions].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      
      switch (sortField) {
        case 'buffer':
          aVal = a.distanceToLiquidation;
          bVal = b.distanceToLiquidation;
          break;
        case 'scenarioBuffer':
          aVal = a.scenario?.simulatedBuffer ?? a.distanceToLiquidation;
          bVal = b.scenario?.simulatedBuffer ?? b.distanceToLiquidation;
          break;
        case 'debt':
          aVal = a.totalDebtUsd;
          bVal = b.totalDebtUsd;
          break;
        case 'collateral':
          aVal = a.baseAssetUsd + a.quoteAssetUsd;
          bVal = b.baseAssetUsd + b.quoteAssetUsd;
          break;
        case 'reward':
          aVal = calculateNetProfit(a);
          bVal = calculateNetProfit(b);
          break;
        case 'pair':
          aVal = `${a.baseAssetSymbol}/${a.quoteAssetSymbol}`;
          bVal = `${b.baseAssetSymbol}/${b.quoteAssetSymbol}`;
          break;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    
    return sorted;
  }, [filteredPositions, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedPositions.length / ITEMS_PER_PAGE);
  const paginatedPositions = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedPositions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedPositions, currentPage]);

  // Reset to page 1 when filters/search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, searchQuery, isActive, shockPct]);

  // Count by status - when shock active, counts reflect shocked state
  const statusCounts = React.useMemo(() => {
    // When shock is active, "liquidatable" means "would be liquidatable at shock"
    const liquidatableCount = isActive && shockPct !== 0
      ? positionsWithScenario.filter(p => p.scenario?.wouldLiquidate).length
      : positions.filter(p => p.isLiquidatable).length;

    return {
      all: positions.length,
      liquidatable: liquidatableCount,
      critical: positions.filter(p => !p.isLiquidatable && p.distanceToLiquidation < 10).length,
      watch: positions.filter(p => !p.isLiquidatable && p.distanceToLiquidation >= 10 && p.distanceToLiquidation < 30).length,
      safe: positions.filter(p => !p.isLiquidatable && p.distanceToLiquidation >= 30).length,
    };
  }, [positions, positionsWithScenario, isActive, shockPct]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'buffer' || field === 'scenarioBuffer' ? 'asc' : 'desc');
    }
  };

  // Auto-switch to scenario buffer sort when scenario is active
  React.useEffect(() => {
    if (isActive && sortField === 'buffer') {
      setSortField('scenarioBuffer');
    } else if (!isActive && sortField === 'scenarioBuffer') {
      setSortField('buffer');
    }
  }, [isActive, sortField]);

  const SortIcon = ({ field }: { field: SortField }) => (
    <svg
      className={`w-3 h-3 transition-transform ${sortField === field ? 'text-teal-400' : 'text-white/20'} ${
        sortField === field && sortDirection === 'desc' ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );

  if (isLoading && positions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
        <div className="h-64 bg-white/[0.03] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Active Positions</h3>
        <p className="text-sm text-white/50">There are no borrowing positions in the system to monitor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Risk Panel - Unified risk distribution + stress controls */}
      <RiskPanel
        positions={positions}
        isLoading={isLoading}
        onFilterChange={setFilterMode}
        activeFilter={filterMode}
      />

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by position ID..."
              className="w-56 pl-9 pr-8 py-1.5 text-sm bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-white/40 hover:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            {[
              { key: 'all' as RiskFilter, label: 'All', count: statusCounts.all },
              { key: 'liquidatable' as RiskFilter, label: 'At Risk', count: statusCounts.liquidatable, color: 'text-orange-400' },
              { key: 'critical' as RiskFilter, label: 'Critical', count: statusCounts.critical, color: 'text-amber-400' },
              { key: 'watch' as RiskFilter, label: 'Watch', count: statusCounts.watch, color: 'text-teal-400' },
              { key: 'safe' as RiskFilter, label: 'Safe', count: statusCounts.safe, color: 'text-emerald-400' },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setFilterMode(filter.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  filterMode === filter.key
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {filter.label}
                <span className={`tabular-nums ${filter.color || ''}`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="text-xs text-white/40">
          Showing {sortedPositions.length} of {positions.length} positions
          {searchQuery && (
            <span className="ml-1 text-teal-400">(filtered)</span>
          )}
          {sortField && (
            <span className="ml-2">
              · Sorted by <span className="text-white/60">{sortField === 'scenarioBuffer' ? 'shock buffer' : sortField}</span>
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Scenario indicator bar when active */}
        {isActive && shockPct !== 0 && (
          <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/40">Scenario:</span>
              <span className="font-semibold text-white">
                {shockAsset} {shockPct > 0 ? '+' : ''}{shockPct}%
              </span>
            </div>
            <button
              onClick={resetScenario}
              className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
            >
              Reset
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider bg-white/[0.02]">
                <th className="text-left py-3 px-4 text-white/40 font-medium">Status</th>
                <th 
                  className="text-left py-3 px-4 text-white/40 font-medium cursor-pointer hover:text-white/60 transition-colors"
                  onClick={() => handleSort('pair')}
                >
                  <div className="flex items-center gap-1">
                    Position
                    <SortIcon field="pair" />
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-white/40 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    Direction
                    <InfoTooltip tooltip="positionDirection" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-4 text-white/40 font-medium cursor-pointer hover:text-white/60 transition-colors"
                  onClick={() => handleSort(isActive ? 'scenarioBuffer' : 'buffer')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {isActive ? 'Shock Buffer' : 'Buffer'}
                    <SortIcon field={isActive ? 'scenarioBuffer' : 'buffer'} />
                  </div>
                </th>
                {isActive && (
                  <th className="text-center py-3 px-4 text-white/40 font-medium">
                    Impact
                  </th>
                )}
                <th 
                  className="text-right py-3 px-4 text-white/40 font-medium cursor-pointer hover:text-white/60 transition-colors"
                  onClick={() => handleSort('collateral')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Collateral
                    <SortIcon field="collateral" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-4 text-white/40 font-medium cursor-pointer hover:text-white/60 transition-colors"
                  onClick={() => handleSort('debt')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Debt
                    <SortIcon field="debt" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-white/40 font-medium">Health</th>
                <th 
                  className="text-right py-3 px-4 text-white/40 font-medium cursor-pointer hover:text-white/60 transition-colors"
                  onClick={() => handleSort('reward')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Est. Profit
                    <InfoTooltip tooltip="estimatedProfit" />
                    <SortIcon field="reward" />
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-white/40 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPositions.map((position) => {
                const band = getRiskBand(position);
                const badge = getStatusBadge(band);
                const netProfit = calculateNetProfit(position);
                const collateralUsd = position.baseAssetUsd + position.quoteAssetUsd;
                const isExpanded = expandedRow === position.marginManagerId;
                const scenario = position.scenario;

                return (
                  <React.Fragment key={position.marginManagerId}>
                    <tr
                      className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer ${
                        position.isLiquidatable ? 'bg-orange-500/5' : 
                        scenario?.wouldLiquidate ? 'bg-rose-500/[0.03]' : ''
                      }`}
                      onClick={() => setExpandedRow(isExpanded ? null : position.marginManagerId)}
                    >
                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-[9px] font-bold rounded border ${badge.bgColor} ${badge.textColor} ${badge.borderColor}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Position */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {position.baseAssetSymbol}/{position.quoteAssetSymbol}
                              </span>
                            </div>
                            <a
                              href={`https://suivision.xyz/object/${position.marginManagerId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {formatAddress(position.marginManagerId)}
                              <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Direction */}
                      <td className="py-3 px-4 text-center">
                        {(() => {
                          const { direction, netExposureUsd } = getPositionDirection(position);
                          const badge = getDirectionBadge(direction);
                          return (
                            <div className="flex flex-col items-center gap-0.5 group relative">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${badge.bgColor} ${badge.textColor} flex items-center gap-1`}>
                                <span>{badge.icon}</span>
                                {badge.label}
                              </span>
                              <span className="text-[9px] text-white/30 tabular-nums">
                                {netExposureUsd >= 0 ? '+' : ''}{formatUsd(netExposureUsd)}
                              </span>
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                <div className="bg-slate-900 border border-white/20 rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-xl">
                                  {badge.tooltip}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Buffer with Scenario */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end">
                          {/* Current buffer */}
                          <span className={`text-sm font-bold tabular-nums ${
                            position.isLiquidatable ? 'text-rose-400' :
                            position.distanceToLiquidation < 10 ? 'text-amber-400' :
                            position.distanceToLiquidation < 30 ? 'text-teal-400' :
                            'text-emerald-400'
                          }`}>
                            {position.isLiquidatable ? (
                              <span className="text-rose-400">UNDERWATER</span>
                            ) : (
                              `+${position.distanceToLiquidation.toFixed(1)}%`
                            )}
                          </span>
                          
                          {/* Scenario buffer */}
                          {scenario && (
                            <span className={`text-[10px] tabular-nums ${
                              scenario.wouldLiquidate ? 'text-rose-400 font-semibold' :
                              scenario.simulatedBuffer < 10 ? 'text-amber-400' :
                              'text-white/40'
                            }`}>
                              → {scenario.wouldLiquidate 
                                ? 'LIQ' 
                                : `${scenario.simulatedBuffer > 0 ? '+' : ''}${scenario.simulatedBuffer.toFixed(1)}%`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Impact Column (only in scenario mode) */}
                      {isActive && (
                        <td className="py-3 px-4 text-center">
                          {scenario ? (
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${getImpactBadge(scenario.impact).bgColor} ${getImpactBadge(scenario.impact).textColor}`}>
                              {scenario.impact}
                            </span>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                      )}

                      {/* Collateral */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-white/80 tabular-nums">{formatUsd(collateralUsd)}</span>
                      </td>

                      {/* Debt */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-white/80 tabular-nums">{formatUsd(position.totalDebtUsd)}</span>
                      </td>

                      {/* Health Factor */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`tabular-nums ${
                            position.riskRatio < 1.0 ? 'text-rose-400' :
                            position.riskRatio < 1.2 ? 'text-amber-400' :
                            'text-white/60'
                          }`}>
                            {position.riskRatio.toFixed(2)}
                          </span>
                          {scenario && (
                            <span className={`text-[10px] tabular-nums ${
                              scenario.simulatedHealthFactor < 1.0 ? 'text-rose-400' :
                              scenario.simulatedHealthFactor < 1.2 ? 'text-amber-400' :
                              'text-white/30'
                            }`}>
                              → {scenario.simulatedHealthFactor.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Est. Profit */}
                      <td className="py-3 px-4 text-right">
                        {position.isLiquidatable ? (
                          <span className={`text-sm font-medium tabular-nums ${netProfit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {netProfit > 0 ? '+' : ''}{formatUsd(netProfit)}
                          </span>
                        ) : (
                          <span className="text-sm tabular-nums text-white/40">
                            {netProfit > 0 ? '+' : ''}{formatUsd(netProfit)}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        {position.isLiquidatable ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onLiquidate(position);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 transition-all flex items-center gap-1.5 mx-auto whitespace-nowrap"
                            title="Attempt liquidation - may fail if price moved"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Try Liquidation
                          </button>
                        ) : (
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-white/50 cursor-default"
                            disabled
                          >
                            Healthy
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Row Details */}
                    {isExpanded && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={isActive ? 11 : 10} className="py-4 px-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Base Asset</div>
                              <div className="text-sm text-white">
                                {position.baseAssetSymbol}: {formatUsd(position.baseAssetUsd)}
                              </div>
                              <div className="text-xs text-white/40">
                                Debt: {formatUsd(position.baseDebtUsd)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Quote Asset</div>
                              <div className="text-sm text-white">
                                {position.quoteAssetSymbol}: {formatUsd(position.quoteAssetUsd)}
                              </div>
                              <div className="text-xs text-white/40">
                                Debt: {formatUsd(position.quoteDebtUsd)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Liquidation Threshold</div>
                              <div className="text-sm text-white tabular-nums">
                                {position.liquidationThreshold.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Est. Reward</div>
                              <div className="text-sm text-emerald-400 tabular-nums">
                                {formatUsd(position.estimatedRewardUsd)}
                              </div>
                              <div className="text-xs text-white/40">
                                (before gas/slippage)
                              </div>
                            </div>
                          </div>
                          
                          {/* Scenario impact details */}
                          {scenario && (
                            <div className="mt-4 pt-4 border-t border-white/[0.06]">
                              <div className="text-[10px] uppercase tracking-wider text-rose-400 mb-2">
                                Scenario Impact: {shockAsset} {shockPct > 0 ? '+' : ''}{shockPct}%
                              </div>
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-white/40">Buffer:</span>{' '}
                                  <span className="text-white">{position.distanceToLiquidation.toFixed(1)}%</span>{' '}
                                  <span className="text-white/40">→</span>{' '}
                                  <span className={scenario.wouldLiquidate ? 'text-rose-400' : 'text-white'}>
                                    {scenario.wouldLiquidate ? 'LIQUIDATED' : `${scenario.simulatedBuffer.toFixed(1)}%`}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-white/40">Health:</span>{' '}
                                  <span className="text-white">{position.riskRatio.toFixed(2)}</span>{' '}
                                  <span className="text-white/40">→</span>{' '}
                                  <span className={scenario.simulatedHealthFactor < 1.05 ? 'text-rose-400' : 'text-white'}>
                                    {scenario.simulatedHealthFactor.toFixed(2)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-white/40">Δ Buffer:</span>{' '}
                                  <span className={scenario.bufferDelta < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                    {scenario.bufferDelta > 0 ? '+' : ''}{scenario.bufferDelta.toFixed(1)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-white/40">Impact:</span>{' '}
                                  <span className={`font-semibold ${
                                    scenario.impact === 'LIQ' ? 'text-rose-400' :
                                    scenario.impact === 'WATCH' ? 'text-amber-400' :
                                    'text-emerald-400'
                                  }`}>
                                    {scenario.impact}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
            <div className="text-xs text-white/40">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedPositions.length)} of {sortedPositions.length} positions
            </div>
            <div className="flex items-center gap-1">
              {/* First Page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Previous Page */}
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-0.5 mx-1">
                {(() => {
                  const pages: (number | 'ellipsis')[] = [];
                  const maxVisible = 5;
                  
                  if (totalPages <= maxVisible) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    
                    if (currentPage > 3) {
                      pages.push('ellipsis');
                    }
                    
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    
                    for (let i = start; i <= end; i++) {
                      if (!pages.includes(i)) pages.push(i);
                    }
                    
                    if (currentPage < totalPages - 2) {
                      pages.push('ellipsis');
                    }
                    
                    if (!pages.includes(totalPages)) pages.push(totalPages);
                  }
                  
                  return pages.map((page, idx) => 
                    page === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-white/30">…</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-teal-500 text-slate-900'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  );
                })()}
              </div>

              {/* Next Page */}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Last Page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="flex items-center justify-between text-[10px] text-white/30 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            At Risk
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Critical (&lt; 10%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            Watch (10-30%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Safe (&gt; 30%)
          </span>
        </div>
        <span>Click row to expand · Click chart segments to filter</span>
      </div>
    </div>
  );
}
