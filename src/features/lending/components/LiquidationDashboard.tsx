import React from "react";
import { useAtRiskPositions, useRiskDistribution, type AtRiskPosition } from "../../../hooks/useAtRiskPositions";
import { LiveRiskMonitor } from "./LiveRiskMonitor";
import { LiquidationAnalytics } from "./LiquidationAnalytics";
import { ProtocolProofSection } from "./ProtocolProofSection";
import { TransactionDetailsModal } from "../../../components/TransactionButton/TransactionDetailsModal";
import { CONTRACTS } from "../../../config/contracts";
import { useSuiClientContext } from "@mysten/dapp-kit";

/**
 * Unified Liquidation Center
 * 
 * A single-page dashboard covering:
 * 1. System Status Hero - Health verdict + key metrics at a glance
 * 2. Live Risk Monitor - Sortable table with all positions, status badges, one-click liquidate
 * 3. Liquidation Analytics - Risk distribution histogram + price sensitivity simulator
 * 4. Protocol Proof - Historical stats, bad debt tracking, liquidator leaderboard
 */

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatAddress(address: string): string {
  if (!address || address.length < 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function calculateNetProfit(position: AtRiskPosition): number {
  const grossReward = position.estimatedRewardUsd;
  const estimatedGasCost = 0.50;
  const estimatedSlippage = position.totalDebtUsd * 0.003;
  return grossReward - estimatedGasCost - estimatedSlippage;
}

type ExploreTab = 'monitor' | 'analytics' | 'proof';

export function LiquidationDashboard() {
  const { network } = useSuiClientContext();
  const [activeTab, setActiveTab] = React.useState<ExploreTab>('monitor');
  const [selectedPosition, setSelectedPosition] = React.useState<AtRiskPosition | null>(null);
  const [showTxModal, setShowTxModal] = React.useState(false);

  const contracts = network === 'mainnet' ? CONTRACTS.mainnet : CONTRACTS.testnet;

  // At-risk positions hook
  const {
    positions,
    liquidatableCount,
    atRiskCount,
    totalDebtAtRiskUsd,
    isLoading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
    lastUpdated,
  } = useAtRiskPositions();

  // Risk distribution from positions
  const riskDistribution = useRiskDistribution(positions);

  // Calculate additional metrics
  const metrics = React.useMemo(() => {
    const liquidatablePositions = positions.filter(p => p.isLiquidatable);
    const totalLiquidatableDebt = liquidatablePositions.reduce((sum, p) => sum + p.totalDebtUsd, 0);
    const totalProfit = liquidatablePositions.reduce((sum, p) => sum + calculateNetProfit(p), 0);
    
    const nonLiquidatable = positions.filter(p => !p.isLiquidatable);
    const smallestBuffer = nonLiquidatable.length > 0
      ? Math.min(...nonLiquidatable.map(p => p.distanceToLiquidation))
      : null;
    
    const criticalCount = positions.filter(p => !p.isLiquidatable && p.distanceToLiquidation < 10).length;
    const watchCount = positions.filter(p => !p.isLiquidatable && p.distanceToLiquidation >= 10 && p.distanceToLiquidation < 25).length;
    
    return {
      totalPositions: positions.length,
      liquidatablePositions: liquidatableCount,
      totalLiquidatableDebt,
      totalProfit,
      smallestBuffer,
      criticalCount,
      watchCount,
    };
  }, [positions, liquidatableCount]);

  // System status
  const systemStatus = liquidatableCount > 0 
    ? 'critical' 
    : metrics.smallestBuffer !== null && metrics.smallestBuffer < 10 
      ? 'stressed' 
      : 'healthy';

  const handleLiquidate = (position: AtRiskPosition) => {
    setSelectedPosition(position);
    setShowTxModal(true);
  };

  const transactionInfo = selectedPosition ? {
    action: 'Liquidate Position',
    packageId: contracts.MARGIN_PACKAGE_ID,
    module: 'margin_manager',
    function: 'liquidate',
    summary: `Liquidate position with ${formatUsd(selectedPosition.totalDebtUsd)} debt. Est. profit: ${formatUsd(calculateNetProfit(selectedPosition))}`,
    sourceCodeUrl: `https://suivision.xyz/package/${contracts.MARGIN_PACKAGE_ID}`,
    arguments: [
      { name: 'Position', value: formatAddress(selectedPosition.marginManagerId) },
      { name: 'Health', value: selectedPosition.riskRatio.toFixed(4) },
      { name: 'Debt', value: formatUsd(selectedPosition.totalDebtUsd) },
      { name: 'Est. Net Profit', value: formatUsd(calculateNetProfit(selectedPosition)) },
    ],
  } : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ═══════════════════════════════════════════════════════════════════
          PAGE HEADER - Title, description, live indicator
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            Liquidation Center
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${
              systemStatus === 'healthy'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : systemStatus === 'stressed'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
            }`}>
              {systemStatus === 'healthy' ? 'Healthy' : systemStatus === 'stressed' ? 'Stressed' : 'Critical'}
            </span>
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Monitor system risk, find opportunities, verify protocol health
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Last updated */}
          {lastUpdated && (
            <span className="text-xs text-white/40">
              Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          
          {/* Live indicator */}
          <span className="flex items-center gap-2 text-xs text-white/60 bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.08]">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </span>
          
          {/* Refresh button */}
          <button
            onClick={refetchPositions}
            disabled={positionsLoading}
            className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <svg
              className={`w-4 h-4 text-white/60 ${positionsLoading ? 'animate-spin' : ''}`}
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
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO METRICS STRIP - Key numbers at a glance
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Positions */}
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Total Positions</div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {positionsLoading && metrics.totalPositions === 0 ? (
              <div className="h-8 w-12 bg-white/10 rounded animate-pulse" />
            ) : (
              metrics.totalPositions
            )}
          </div>
          <div className="text-xs text-white/30 mt-1">monitored</div>
        </div>

        {/* Liquidatable Now */}
        <div className={`rounded-xl p-4 border ${
          liquidatableCount > 0 
            ? 'bg-rose-500/10 border-rose-500/30' 
            : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Liquidatable Now</div>
          <div className={`text-2xl font-bold tabular-nums ${liquidatableCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {positionsLoading && metrics.totalPositions === 0 ? (
              <div className="h-8 w-12 bg-white/10 rounded animate-pulse" />
            ) : (
              liquidatableCount
            )}
          </div>
          <div className={`text-xs mt-1 ${liquidatableCount > 0 ? 'text-rose-300' : 'text-white/30'}`}>
            {liquidatableCount > 0 ? formatUsd(metrics.totalLiquidatableDebt) + ' debt' : 'none'}
          </div>
        </div>

        {/* Critical (< 10%) */}
        <div className={`rounded-xl p-4 border ${
          metrics.criticalCount > 0 
            ? 'bg-amber-500/10 border-amber-500/30' 
            : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Critical</div>
          <div className={`text-2xl font-bold tabular-nums ${metrics.criticalCount > 0 ? 'text-amber-400' : 'text-white/30'}`}>
            {metrics.criticalCount}
          </div>
          <div className="text-xs text-white/30 mt-1">&lt; 10% buffer</div>
        </div>

        {/* Watching */}
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Watching</div>
          <div className="text-2xl font-bold text-teal-400 tabular-nums">
            {metrics.watchCount}
          </div>
          <div className="text-xs text-white/30 mt-1">10-25% buffer</div>
        </div>

        {/* Smallest Buffer */}
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Closest to Liq</div>
          <div className={`text-2xl font-bold tabular-nums ${
            metrics.smallestBuffer === null ? 'text-white/30' :
            metrics.smallestBuffer < 5 ? 'text-rose-400' :
            metrics.smallestBuffer < 15 ? 'text-amber-400' :
            'text-emerald-400'
          }`}>
            {metrics.smallestBuffer !== null ? `${metrics.smallestBuffer.toFixed(0)}%` : '—'}
          </div>
          <div className="text-xs text-white/30 mt-1">buffer</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PROFIT OPPORTUNITY BANNER - Only shows if liquidatable positions exist
      ═══════════════════════════════════════════════════════════════════ */}
      {liquidatableCount > 0 && (
        <div className="bg-gradient-to-r from-rose-500/20 to-rose-500/10 rounded-xl border border-rose-500/30 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-rose-200">
                  {liquidatableCount} Position{liquidatableCount > 1 ? 's' : ''} Ready to Liquidate
                </h3>
                <p className="text-sm text-white/60">
                  Potential profit: <span className="text-emerald-400 font-semibold">{formatUsd(metrics.totalProfit)}</span>
                  {' '}· Total debt: {formatUsd(metrics.totalLiquidatableDebt)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('monitor')}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-400 text-white transition-all flex items-center gap-2"
            >
              View Opportunities
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION NAVIGATION - Monitor, Analytics, Proof
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1">
        <span className="text-[10px] uppercase tracking-wider font-medium text-white/30 mr-2">Explore:</span>
        
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all flex items-center gap-2 border-b-2 -mb-[5px] ${
            activeTab === 'monitor'
              ? 'bg-white/[0.06] text-white border-teal-400'
              : 'text-white/50 hover:text-white hover:bg-white/[0.03] border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Live Risk Monitor
          {liquidatableCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500 text-white">
              {liquidatableCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all flex items-center gap-2 border-b-2 -mb-[5px] ${
            activeTab === 'analytics'
              ? 'bg-white/[0.06] text-white border-teal-400'
              : 'text-white/50 hover:text-white hover:bg-white/[0.03] border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Liquidation Analytics
        </button>

        <button
          onClick={() => setActiveTab('proof')}
          className={`px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all flex items-center gap-2 border-b-2 -mb-[5px] ${
            activeTab === 'proof'
              ? 'bg-white/[0.06] text-white border-teal-400'
              : 'text-white/50 hover:text-white hover:bg-white/[0.03] border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Protocol Proof & History
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="min-h-[500px]">
        {/* Error State */}
        {positionsError && activeTab !== 'proof' && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center">
            <p className="text-rose-400">
              Error loading positions: {positionsError.message}
            </p>
            <button
              onClick={refetchPositions}
              className="mt-3 px-4 py-2 text-sm bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Live Risk Monitor */}
        {activeTab === 'monitor' && !positionsError && (
          <LiveRiskMonitor
            positions={positions}
            isLoading={positionsLoading}
            onLiquidate={handleLiquidate}
            lastUpdated={lastUpdated}
          />
        )}

        {/* Liquidation Analytics */}
        {activeTab === 'analytics' && !positionsError && (
          <LiquidationAnalytics
            positions={positions}
            riskDistribution={riskDistribution}
            isLoading={positionsLoading}
          />
        )}

        {/* Protocol Proof & History */}
        {activeTab === 'proof' && (
          <ProtocolProofSection />
        )}
      </div>

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
    </div>
  );
}
