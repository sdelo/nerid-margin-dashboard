import React from 'react';
import { type AtRiskPosition } from '../../../hooks/useAtRiskPositions';
import { TransactionDetailsModal } from '../../../components/TransactionButton/TransactionDetailsModal';
import { PositionHistoryModal } from './PositionHistoryModal';
import { PositionDetailDrawer } from './PositionDetailDrawer';
import { CONTRACTS } from '../../../config/contracts';
import { useSuiClientContext } from '@mysten/dapp-kit';

interface AtRiskPositionsTableProps {
  positions: AtRiskPosition[];
  isLoading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

/**
 * Format relative time (e.g., "12s ago", "2m ago")
 */
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
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
 * Get status badge based on risk level
 */
function getRiskBadge(position: AtRiskPosition): { label: string; className: string } {
  if (position.isLiquidatable) {
    return {
      label: 'LIQUIDATABLE',
      className: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
    };
  }
  if (position.distanceToLiquidation < 5) {
    return {
      label: 'CRITICAL',
      className: 'bg-amber-500/20 text-teal-300 border-amber-500/40',
    };
  }
  if (position.distanceToLiquidation < 15) {
    return {
      label: 'WARNING',
      className: 'bg-teal-400/15 text-amber-200 border-teal-400/30',
    };
  }
  return {
    label: 'WATCH',
    className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  };
}

/**
 * At-Risk Positions Table Component
 */
export function AtRiskPositionsTable({
  positions,
  isLoading,
  lastUpdated,
  onRefresh,
}: AtRiskPositionsTableProps) {
  const { network } = useSuiClientContext();
  const [selectedPosition, setSelectedPosition] = React.useState<AtRiskPosition | null>(null);
  const [showTxModal, setShowTxModal] = React.useState(false);
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);
  const [historyPosition, setHistoryPosition] = React.useState<AtRiskPosition | null>(null);
  const [drawerPosition, setDrawerPosition] = React.useState<AtRiskPosition | null>(null);
  const [sortField, setSortField] = React.useState<'riskRatio' | 'totalDebtUsd' | 'distanceToLiquidation'>('riskRatio');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [bufferFilter, setBufferFilter] = React.useState<number>(25); // Show positions within X% of liquidation
  const [showWatchlist, setShowWatchlist] = React.useState(false);

  // Get contract addresses based on network
  const contracts = network === 'mainnet' ? CONTRACTS.mainnet : CONTRACTS.testnet;

  // Filter and sort positions
  const { actionablePositions, watchlistPositions } = React.useMemo(() => {
    const actionable = positions.filter(p => 
      p.isLiquidatable || p.distanceToLiquidation <= bufferFilter
    );
    const watchlist = positions.filter(p => 
      !p.isLiquidatable && p.distanceToLiquidation > bufferFilter
    );
    return { actionablePositions: actionable, watchlistPositions: watchlist };
  }, [positions, bufferFilter]);

  const sortedPositions = React.useMemo(() => {
    const positionsToSort = showWatchlist 
      ? [...actionablePositions, ...watchlistPositions]
      : actionablePositions;
    return positionsToSort.sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      return (a[sortField] - b[sortField]) * multiplier;
    });
  }, [actionablePositions, watchlistPositions, showWatchlist, sortField, sortDirection]);

  // Handle sort click
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle liquidate button click
  const handleLiquidateClick = (position: AtRiskPosition) => {
    setSelectedPosition(position);
    setShowTxModal(true);
  };

  // Handle row click to open detail drawer
  const handleRowClick = (position: AtRiskPosition) => {
    setDrawerPosition(position);
  };

  // Handle view history from drawer
  const handleViewHistory = (position: AtRiskPosition) => {
    setHistoryPosition(position);
    setShowHistoryModal(true);
  };

  // Transaction info for the modal
  const transactionInfo = selectedPosition ? {
    action: 'Liquidate Position',
    packageId: contracts.MARGIN_PACKAGE_ID,
    module: 'margin_manager',
    function: 'liquidate',
    summary: `Liquidate margin manager ${formatAddress(selectedPosition.marginManagerId)} with ${formatUsd(selectedPosition.totalDebtUsd)} debt. Expected reward: ~${formatUsd(selectedPosition.estimatedRewardUsd)} (${((selectedPosition.userLiquidationRewardPct + selectedPosition.poolLiquidationRewardPct) * 100).toFixed(1)}%)`,
    sourceCodeUrl: `https://suivision.xyz/package/${contracts.MARGIN_PACKAGE_ID}`,
    arguments: [
      { name: 'Margin Manager', value: formatAddress(selectedPosition.marginManagerId) },
      { name: 'Risk Ratio', value: selectedPosition.riskRatio.toFixed(4) },
      { name: 'Total Debt', value: formatUsd(selectedPosition.totalDebtUsd) },
      { name: 'Est. Reward', value: formatUsd(selectedPosition.estimatedRewardUsd) },
    ],
  } : null;

  // Sort indicator
  const SortIndicator = ({ field }: { field: typeof sortField }) => (
    <span className="ml-1 text-xs">
      {sortField === field ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            At-Risk Positions
            {positions.filter(p => p.isLiquidatable).length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full animate-pulse">
                {positions.filter(p => p.isLiquidatable).length} liquidatable
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sorted by proximity to liquidation threshold
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Buffer Filter */}
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 border border-white/10">
            <span className="text-xs text-white/50">Buffer:</span>
            <select
              value={bufferFilter}
              onChange={(e) => setBufferFilter(Number(e.target.value))}
              className="bg-transparent text-xs text-white/80 focus:outline-none cursor-pointer"
            >
              <option value={5} className="bg-slate-800">Within 5%</option>
              <option value={10} className="bg-slate-800">Within 10%</option>
              <option value={25} className="bg-slate-800">Within 25%</option>
              <option value={50} className="bg-slate-800">Within 50%</option>
              <option value={100} className="bg-slate-800">All positions</option>
            </select>
          </div>
          
          {lastUpdated && (
            <span className="text-xs text-white/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Updated {formatRelativeTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        {isLoading && positions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading positions...</p>
          </div>
        ) : sortedPositions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-base font-medium text-slate-300">No Positions Within {bufferFilter}% of Liquidation</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              All positions have healthy collateral ratios
            </p>
            {watchlistPositions.length > 0 && !showWatchlist && (
              <button
                onClick={() => setShowWatchlist(true)}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                Show {watchlistPositions.length} watchlist position{watchlistPositions.length !== 1 ? 's' : ''} →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Position</th>
                  <th 
                    className="text-right py-3 px-4 text-slate-400 font-medium cursor-pointer hover:text-slate-200 transition-colors group"
                    onClick={() => handleSort('riskRatio')}
                    title="Health Factor = Collateral Value / Debt Value. Liquidation occurs at threshold (e.g., 1.05)"
                  >
                    <span className="flex items-center justify-end gap-1">
                      Health Factor
                      <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <SortIndicator field="riskRatio" />
                    </span>
                  </th>
                  <th 
                    className="text-right py-3 px-4 text-slate-400 font-medium cursor-pointer hover:text-slate-200 transition-colors group"
                    onClick={() => handleSort('distanceToLiquidation')}
                    title="Price Buffer = How much further prices can move before liquidation"
                  >
                    <span className="flex items-center justify-end gap-1">
                      Price Buffer
                      <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <SortIndicator field="distanceToLiquidation" />
                    </span>
                  </th>
                  <th 
                    className="text-right py-3 px-4 text-slate-400 font-medium cursor-pointer hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('totalDebtUsd')}
                  >
                    Debt <SortIndicator field="totalDebtUsd" />
                  </th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium" title="Estimated net profit after liquidation incentives">
                    Est. Profit
                  </th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map((position) => {
                  const badge = getRiskBadge(position);
                  return (
                    <tr
                      key={position.marginManagerId}
                      onClick={() => handleRowClick(position)}
                      className={`group border-b border-slate-700/30 hover:bg-slate-700/30 transition-all cursor-pointer ${
                        position.isLiquidatable ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-bold rounded border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <a
                            href={`https://suivision.xyz/object/${position.marginManagerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-cyan-300 hover:text-cyan-200 transition-colors text-xs"
                          >
                            {formatAddress(position.marginManagerId)}
                          </a>
                          <div className="text-xs text-white/40 mt-0.5">
                            {position.baseAssetSymbol}/{position.quoteAssetSymbol}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className={`font-bold tabular-nums ${
                          position.isLiquidatable ? 'text-rose-400' :
                          position.distanceToLiquidation < 5 ? 'text-amber-400' :
                          position.distanceToLiquidation < 15 ? 'text-yellow-400' :
                          'text-emerald-400'
                        }`}>
                          {position.riskRatio.toFixed(3)}
                        </div>
                        <div className="text-xs text-white/40">
                          liq @ {position.liquidationThreshold.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-semibold tabular-nums ${
                          position.distanceToLiquidation < 0 ? 'text-rose-400' :
                          position.distanceToLiquidation < 5 ? 'text-amber-400' :
                          position.distanceToLiquidation < 15 ? 'text-yellow-400' :
                          'text-emerald-400'
                        }`}>
                          {position.distanceToLiquidation < 0 ? '' : '+'}
                          {position.distanceToLiquidation.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-semibold text-white tabular-nums">
                          {formatUsd(position.totalDebtUsd)}
                        </div>
                        <div className="text-xs text-white/40">
                          {position.baseDebt > 0 && `${(position.baseDebt / 1e9).toFixed(2)} ${position.baseAssetSymbol}`}
                          {position.baseDebt > 0 && position.quoteDebt > 0 && ' + '}
                          {position.quoteDebt > 0 && `${(position.quoteDebt / 1e6).toFixed(2)} ${position.quoteAssetSymbol}`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-emerald-400 font-semibold tabular-nums">
                          {formatUsd(position.estimatedRewardUsd)}
                        </span>
                        <div className="text-xs text-white/40">
                          {((position.userLiquidationRewardPct + position.poolLiquidationRewardPct) * 100).toFixed(1)}% incentive
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(position);
                            }}
                            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
                          >
                            View
                          </button>
                          {position.isLiquidatable && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLiquidateClick(position);
                              }}
                              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-rose-500 hover:bg-rose-400 text-white"
                            >
                              Liquidate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Liquidatable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Critical (&lt;5%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>Warning (&lt;15%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Watch</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {watchlistPositions.length > 0 && (
            <button
              onClick={() => setShowWatchlist(!showWatchlist)}
              className="text-teal-400 hover:text-teal-300 transition-colors"
            >
              {showWatchlist ? 'Hide' : 'Show'} {watchlistPositions.length} watchlist
            </button>
          )}
          <span className="text-slate-500">
            Click row to view details
          </span>
        </div>
      </div>

      {/* Position Detail Drawer */}
      {drawerPosition && (
        <PositionDetailDrawer
          position={drawerPosition}
          allPositions={positions}
          isOpen={!!drawerPosition}
          onClose={() => setDrawerPosition(null)}
          onLiquidate={handleLiquidateClick}
          onViewHistory={handleViewHistory}
        />
      )}

      {/* Transaction Modal */}
      {transactionInfo && (
        <TransactionDetailsModal
          isOpen={showTxModal}
          onClose={() => {
            setShowTxModal(false);
            setSelectedPosition(null);
          }}
          onContinue={() => {
            // TODO: Implement actual liquidation transaction
            setShowTxModal(false);
            setSelectedPosition(null);
          }}
          transactionInfo={transactionInfo}
          disabled={!selectedPosition?.isLiquidatable}
        />
      )}

      {/* Position History Modal */}
      {historyPosition && (
        <PositionHistoryModal
          position={historyPosition}
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryPosition(null);
          }}
        />
      )}
    </div>
  );
}

