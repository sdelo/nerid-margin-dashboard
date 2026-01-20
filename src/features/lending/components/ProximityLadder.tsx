import React from 'react';
import { type AtRiskPosition } from '../../../hooks/useAtRiskPositions';

interface ProximityLadderProps {
  positions: AtRiskPosition[];
  onSelectPosition: (position: AtRiskPosition) => void;
  selectedPositionId?: string | null;
}

type RiskBand = 'critical' | 'warning' | 'watch' | 'safe';

interface PositionPill {
  position: AtRiskPosition;
  band: RiskBand;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Get risk band based on buffer percentage
 */
function getRiskBand(buffer: number): RiskBand {
  if (buffer <= 5) return 'critical';
  if (buffer <= 15) return 'warning';
  if (buffer <= 30) return 'watch';
  return 'safe';
}

/**
 * Get band styling
 */
function getBandStyles(band: RiskBand): { label: string; color: string; bgColor: string; borderColor: string } {
  switch (band) {
    case 'critical':
      return {
        label: 'Critical',
        color: 'text-rose-300',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/40',
      };
    case 'warning':
      return {
        label: 'Warning',
        color: 'text-amber-300',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/40',
      };
    case 'watch':
      return {
        label: 'Watch',
        color: 'text-teal-300',
        bgColor: 'bg-teal-500/10',
        borderColor: 'border-teal-500/40',
      };
    case 'safe':
      return {
        label: 'Safe',
        color: 'text-emerald-300',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
      };
  }
}

/**
 * Format address for display
 */
function formatAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format USD value
 */
function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Calculate net profit estimate for a position
 */
function calculateNetProfit(position: AtRiskPosition): number {
  const grossReward = position.estimatedRewardUsd;
  const estimatedGasCost = 0.50;
  const estimatedSlippage = position.totalDebtUsd * 0.003;
  return grossReward - estimatedGasCost - estimatedSlippage;
}

/**
 * Get confidence level
 */
function getConfidence(position: AtRiskPosition): { level: 'high' | 'medium' | 'low'; color: string } {
  if (!position.isLiquidatable) {
    return { level: 'low', color: 'bg-white/30' };
  }
  
  const netProfit = calculateNetProfit(position);
  
  if (netProfit > 10) {
    return { level: 'high', color: 'bg-emerald-500' };
  }
  
  if (netProfit > 0) {
    return { level: 'medium', color: 'bg-amber-500' };
  }
  
  return { level: 'low', color: 'bg-rose-500' };
}

/**
 * Proximity Ladder - Visual ranking of positions by buffer
 * Shows the closest positions to liquidation with liquidator-focused info
 * 
 * Question it answers: "Which one is closest and what do I make?"
 */
export function ProximityLadder({ positions, onSelectPosition, selectedPositionId }: ProximityLadderProps) {
  // Sort by buffer (distance to liquidation) and take top 10
  const sortedPositions = React.useMemo((): PositionPill[] => {
    return [...positions]
      .sort((a, b) => a.distanceToLiquidation - b.distanceToLiquidation)
      .slice(0, 10)
      .map((position) => {
        const band = getRiskBand(position.distanceToLiquidation);
        const styles = getBandStyles(band);
        return {
          position,
          band,
          ...styles,
        };
      });
  }, [positions]);

  // Count by band for legend
  const bandCounts = React.useMemo(() => {
    const counts = { critical: 0, warning: 0, watch: 0, safe: 0 };
    positions.forEach((p) => {
      const band = getRiskBand(p.distanceToLiquidation);
      counts[band]++;
    });
    return counts;
  }, [positions]);

  if (positions.length === 0) {
    return null;
  }

  // Only show if there are positions worth showing
  if (sortedPositions.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-b from-slate-800/60 to-slate-800/30 rounded-xl border border-white/[0.08] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <h4 className="text-sm font-semibold text-white">Proximity Ladder</h4>
        </div>
        {/* Band legend with counts */}
        <div className="flex items-center gap-3 text-[10px]">
          {bandCounts.critical > 0 && (
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {bandCounts.critical}
            </span>
          )}
          {bandCounts.warning > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {bandCounts.warning}
            </span>
          )}
          {bandCounts.watch > 0 && (
            <span className="flex items-center gap-1 text-teal-400">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              {bandCounts.watch}
            </span>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-[9px] uppercase tracking-wider text-white/30 border-b border-white/10 mb-1">
        <div className="w-6" /> {/* Rank */}
        <div className="flex-1">Position</div>
        <div className="w-16 text-right">Buffer</div>
        <div className="w-20 text-right">Max Repay</div>
        <div className="w-16 text-right">Est Net</div>
        <div className="w-6 text-center" title="Confidence">●</div>
        <div className="w-4" /> {/* Arrow */}
      </div>

      {/* Ladder - Vertical stack of rows */}
      <div className="space-y-1">
        {sortedPositions.map((pill, idx) => {
          const isSelected = selectedPositionId === pill.position.marginManagerId;
          const isLiquidatable = pill.position.isLiquidatable;
          const netProfit = calculateNetProfit(pill.position);
          const confidence = getConfidence(pill.position);
          
          // Calculate max repay (50% close factor for healthy, 100% for underwater)
          const closeFactorPct = pill.position.riskRatio < 1.0 ? 1.0 : 0.5;
          const maxRepayUsd = pill.position.totalDebtUsd * closeFactorPct;
          
          return (
            <button
              key={pill.position.marginManagerId}
              onClick={() => onSelectPosition(pill.position)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                pill.bgColor
              } ${pill.borderColor} ${
                isSelected 
                  ? 'ring-2 ring-white/30 ring-offset-1 ring-offset-slate-900' 
                  : 'hover:brightness-125'
              } ${isLiquidatable ? 'animate-pulse' : ''}`}
            >
              {/* Rank indicator */}
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white/60">{idx + 1}</span>
              </div>

              {/* Position info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white truncate">
                    {pill.position.baseAssetSymbol}/{pill.position.quoteAssetSymbol}
                  </span>
                  {isLiquidatable && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-rose-500 text-white rounded">
                      LIQ
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-white/40 truncate font-mono">
                  {formatAddress(pill.position.marginManagerId)}
                </div>
              </div>

              {/* Buffer percentage */}
              <div className="w-16 text-right flex-shrink-0">
                <div className={`text-sm font-bold tabular-nums ${pill.color}`}>
                  {pill.position.distanceToLiquidation < 0 ? '' : '+'}
                  {pill.position.distanceToLiquidation.toFixed(1)}%
                </div>
              </div>

              {/* Max Repay */}
              <div className="w-20 text-right flex-shrink-0">
                <div className="text-xs text-white/70 tabular-nums">
                  {formatUsd(maxRepayUsd)}
                </div>
              </div>

              {/* Est Net Profit */}
              <div className="w-16 text-right flex-shrink-0">
                <div className={`text-xs font-medium tabular-nums ${
                  !isLiquidatable ? 'text-white/30' :
                  netProfit > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isLiquidatable ? (
                    <>
                      {netProfit > 0 ? '+' : ''}{formatUsd(netProfit)}
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              {/* Confidence dot */}
              <div className="w-6 flex justify-center flex-shrink-0">
                <div 
                  className={`w-2.5 h-2.5 rounded-full ${confidence.color}`}
                  title={`${confidence.level} confidence`}
                />
              </div>

              {/* Arrow indicator */}
              <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Footer - show if more positions exist */}
      {positions.length > 10 && (
        <div className="mt-3 pt-2 border-t border-white/[0.06] text-center">
          <span className="text-[10px] text-white/30">
            Showing top 10 of {positions.length} positions · Click row for details
          </span>
        </div>
      )}

      {/* Band scale reference */}
      <div className="mt-3 pt-2 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[9px] text-white/30">
          <span>0-5%</span>
          <span>5-15%</span>
          <span>15-30%</span>
          <span>30%+</span>
        </div>
        <div className="flex gap-0.5 mt-1">
          <div className="flex-1 h-1 rounded-l bg-rose-500/60" />
          <div className="flex-1 h-1 bg-amber-500/60" />
          <div className="flex-1 h-1 bg-teal-500/60" />
          <div className="flex-1 h-1 rounded-r bg-emerald-500/60" />
        </div>
        <div className="flex items-center justify-between text-[8px] text-white/20 mt-0.5">
          <span>Critical</span>
          <span>Warning</span>
          <span>Watch</span>
          <span>Safe</span>
        </div>
      </div>
    </div>
  );
}
