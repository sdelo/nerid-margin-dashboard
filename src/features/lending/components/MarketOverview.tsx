import React from 'react';
import { type AtRiskPosition, getPositionDirection } from '../../../hooks/useAtRiskPositions';
import { simulatePositionAtShock } from '../../../context/ScenarioContext';
import { fetchLoanBorrowed } from '../api/events';

interface MarketOverviewProps {
  positions: AtRiskPosition[];
  isLoading: boolean;
  onOpenWallet?: (position: AtRiskPosition) => void;
  /** Which coins are selected globally */
  selectedCoins?: string[];
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(0)}`;
  if (value > 0) return '<$1';
  return '$0';
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toFixed(0)}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function formatAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Compute approximate leverage multiplier
 * leverage = totalCollateral / equity, where equity = collateral - debt
 */
function computeLeverage(position: AtRiskPosition): number {
  const totalCollateral = position.baseAssetUsd + position.quoteAssetUsd;
  const equity = totalCollateral - position.totalDebtUsd;
  if (equity <= 0) return 99; // effectively infinite
  return totalCollateral / equity;
}

/**
 * Format time since a position was opened
 */
function formatTimeOpen(openTimestamp: number): string {
  const diff = Date.now() - openTimestamp;
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

/**
 * Notability score — how "tweet-worthy" is this position?
 * Balances proximity to liquidation with position size and leverage
 */
function dramaScore(position: AtRiskPosition): number {
  const sizeLog = Math.log10(1 + position.totalDebtUsd / 100);
  const proximity = 100 / (1 + position.distanceToLiquidation / 10);
  const leverage = computeLeverage(position);
  return proximity * sizeLog * Math.min(leverage / 2, 10);
}

/**
 * Health bar percentage (0-100, where 100 = very safe)
 * Maps distanceToLiquidation to a 0-100 scale where 50%+ buffer = full bar
 */
function healthPct(position: AtRiskPosition): number {
  if (position.isLiquidatable) return 0;
  return Math.min((position.distanceToLiquidation / 50) * 100, 100);
}

/**
 * Health bar color based on percentage
 */
function healthColor(pct: number): string {
  if (pct <= 0) return '#ef4444';    // red — liquidatable
  if (pct < 15) return '#f43f5e';    // rose
  if (pct < 30) return '#f97316';    // orange
  if (pct < 50) return '#eab308';    // yellow
  if (pct < 70) return '#84cc16';    // lime
  return '#22c55e';                   // green
}

/**
 * Danger level classification for spectator-friendly display
 */
function dangerLevel(position: AtRiskPosition): {
  label: string;
  textColor: string;
  cardBg: string;
  cardBorder: string;
  glow: string;
} {
  if (position.isLiquidatable) return {
    label: '☠ LIQUIDATABLE',
    textColor: 'text-rose-400',
    cardBg: 'bg-gradient-to-br from-rose-500/[0.08] to-rose-900/[0.04]',
    cardBorder: 'border-rose-500/20',
    glow: 'shadow-[0_4px_24px_-6px_rgba(244,63,94,0.25)]',
  };
  if (position.distanceToLiquidation < 5) return {
    label: 'CRITICAL',
    textColor: 'text-rose-400',
    cardBg: 'bg-gradient-to-br from-rose-500/[0.06] to-transparent',
    cardBorder: 'border-rose-500/15',
    glow: 'shadow-[0_4px_20px_-6px_rgba(244,63,94,0.15)]',
  };
  if (position.distanceToLiquidation < 10) return {
    label: 'AT RISK',
    textColor: 'text-orange-400',
    cardBg: 'bg-gradient-to-br from-orange-500/[0.05] to-transparent',
    cardBorder: 'border-orange-500/15',
    glow: '',
  };
  if (position.distanceToLiquidation < 25) return {
    label: 'WATCHING',
    textColor: 'text-amber-400',
    cardBg: 'bg-gradient-to-br from-amber-500/[0.04] to-transparent',
    cardBorder: 'border-amber-500/10',
    glow: '',
  };
  return {
    label: 'SAFE',
    textColor: 'text-emerald-400',
    cardBg: 'bg-white/[0.025]',
    cardBorder: 'border-white/[0.06]',
    glow: '',
  };
}

/**
 * The Market Right Now — Spectator-first hero section
 *
 * - Net Positioning: big bold crowdedness indicator
 * - Liquidation Gravity: real price levels, not percentages
 * - Hot Positions: health bars, drama-sorted, emotional read
 */
export function MarketOverview({ positions, isLoading, onOpenWallet, selectedCoins }: MarketOverviewProps) {
  const activePositions = positions.filter(p => p.totalDebtUsd > 0.01);

  // Determine the primary asset for gravity label + price calculations
  const primaryAsset = React.useMemo(() => {
    if (selectedCoins && selectedCoins.length === 1) return selectedCoins[0];
    const assets = new Set(activePositions.map(p => p.baseAssetSymbol));
    if (assets.size === 1) return Array.from(assets)[0];
    return 'ALL';
  }, [activePositions, selectedCoins]);

  // Current price of the primary asset (for gravity price levels)
  const currentPrice = React.useMemo(() => {
    if (primaryAsset === 'ALL') return null;
    const assetPos = activePositions.find(p => p.baseAssetSymbol === primaryAsset && p.basePythPrice > 0);
    if (!assetPos) return null;
    return assetPos.basePythPrice / Math.pow(10, Math.abs(assetPos.basePythDecimals));
  }, [activePositions, primaryAsset]);

  // ─── Net Positioning ───────────────────────────────────────────────────────
  const positioning = React.useMemo(() => {
    let longUsd = 0;
    let shortUsd = 0;
    let longCount = 0;
    let shortCount = 0;

    activePositions.forEach(p => {
      const { direction, netExposureUsd } = getPositionDirection(p);
      if (direction === 'LONG') {
        longUsd += Math.abs(netExposureUsd);
        longCount++;
      } else {
        shortUsd += Math.abs(netExposureUsd);
        shortCount++;
      }
    });

    const total = longUsd + shortUsd;
    const longPct = total > 0 ? (longUsd / total) * 100 : 50;

    return { longUsd, shortUsd, longCount, shortCount, longPct, total };
  }, [activePositions]);

  // ─── Bi-directional Liquidation Gravity ─────────────────────────────────────
  // Downside shocks hurt longs, upside shocks hurt shorts
  const { downsideGravity, upsideGravity, maxGravityDebtAll } = React.useMemo(() => {
    const shockAsset = primaryAsset === 'ALL' ? 'ALL' : primaryAsset;
    const allShocks = [30, 20, 15, 10, 5, -5, -10, -15, -20, -30, -50];

    const results = allShocks.map(shockPct => {
      let debtAtRisk = 0;
      let positionCount = 0;

      activePositions.forEach(p => {
        const sim = simulatePositionAtShock(p, shockPct, shockAsset);
        if (sim.wouldLiquidate) {
          debtAtRisk += p.totalDebtUsd;
          positionCount++;
        }
      });

      const priceAtShock = currentPrice ? currentPrice * (1 + shockPct / 100) : null;
      return { shockPct, debtAtRisk, positionCount, priceAtShock };
    });

    // Split into upside (positive shocks — hurts shorts) and downside (negative — hurts longs)
    const upside = results
      .filter(g => g.shockPct > 0 && (g.positionCount > 0 || g.shockPct <= 20))
      .sort((a, b) => b.shockPct - a.shockPct); // highest first (furthest from current)
    const downside = results
      .filter(g => g.shockPct < 0 && (g.positionCount > 0 || g.shockPct >= -20))
      .sort((a, b) => b.shockPct - a.shockPct); // least negative first (closest to current)

    const maxDebt = Math.max(...results.map(g => g.debtAtRisk), 1);

    return { downsideGravity: downside, upsideGravity: upside, maxGravityDebtAll: maxDebt };
  }, [activePositions, primaryAsset, currentPrice]);

  // ─── Hot Positions (drama-sorted) ─────────────────────────────────────────
  const hotPositions = React.useMemo(() => {
    return [...activePositions]
      .sort((a, b) => dramaScore(b) - dramaScore(a))
      .slice(0, 6);
  }, [activePositions]);

  // ─── Position Ages — fetch "time open" for hot positions ──────────────────
  const positionAgesRef = React.useRef<Map<string, number>>(new Map());
  const [positionAges, setPositionAges] = React.useState<Map<string, number>>(new Map());

  React.useEffect(() => {
    const unknownIds = hotPositions
      .map(p => p.marginManagerId)
      .filter(id => !positionAgesRef.current.has(id));

    if (unknownIds.length === 0) return;

    async function fetchAges() {
      const results = await Promise.allSettled(
        unknownIds.map(async (id) => {
          const events = await fetchLoanBorrowed({
            margin_manager_id: id,
            limit: 50,
            start_time: 0,
          });
          if (events.length > 0) {
            const earliest = Math.min(...events.map(e => e.onchain_timestamp * 1000));
            return { id, timestamp: earliest };
          }
          return null;
        })
      );

      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) {
          positionAgesRef.current.set(r.value.id, r.value.timestamp);
        }
      });

      setPositionAges(new Map(positionAgesRef.current));
    }

    fetchAges();
  }, [hotPositions]);

  if (isLoading && activePositions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="surface-elevated p-6">
          <div className="h-32 bg-white/[0.03] rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (activePositions.length === 0) return null;

  // Crowdedness analysis for positioning
  const isCrowded = positioning.longPct > 70 || positioning.longPct < 30;
  const crowdedSide = positioning.longPct > 50 ? 'LONG' : 'SHORT';
  const crowdedPct = positioning.longPct > 50 ? positioning.longPct : 100 - positioning.longPct;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ─── Section Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-teal-400 to-teal-600" />
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            The Market Right Now
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/80 bg-emerald-500/[0.06] border border-emerald-500/10 px-2.5 py-1 rounded-full">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          Live
        </div>
      </div>

      {/* ─── Net Positioning — THE BIG STORY ─────────────────────────────── */}
      <div className="surface-premium p-6 sm:p-8">
        {/* Massive crowdedness statement */}
        <div className="text-center mb-6">
          <div className={`text-7xl sm:text-8xl font-black tabular-nums leading-none tracking-tighter ${
            isCrowded
              ? (crowdedSide === 'LONG' ? 'text-cyan-400' : 'text-violet-400')
              : 'text-white/30'
          }`} style={{ textShadow: isCrowded ? `0 0 40px ${crowdedSide === 'LONG' ? 'rgba(6,182,212,0.2)' : 'rgba(139,92,246,0.2)'}` : 'none' }}>
            {crowdedPct.toFixed(0)}%
          </div>
          <div className={`text-lg sm:text-xl font-bold mt-2 ${
            isCrowded ? 'text-white/60' : 'text-white/30'
          }`}>
            of DeepBook is{' '}
            <span className={crowdedSide === 'LONG' ? 'text-cyan-400' : 'text-violet-400'}>
              {crowdedSide}
            </span>{' '}
            right now
          </div>
          {isCrowded && (
            <div className="text-sm text-white/25 mt-2 max-w-md mx-auto">
              When everyone&apos;s on one side, liquidation cascades get violent.
            </div>
          )}
          {!isCrowded && (
            <div className="text-sm text-white/25 mt-2 max-w-md mx-auto">
              Market positioning is balanced — no extreme crowding.
            </div>
          )}
        </div>

        {/* Full-width gauge */}
        <div className="max-w-lg mx-auto">
          <div className="relative h-5 rounded-full overflow-hidden bg-white/[0.06]">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${positioning.longPct}%`,
                background: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
              }}
            />
            <div
              className="absolute inset-y-0 right-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${100 - positioning.longPct}%`,
                background: 'linear-gradient(90deg, #a78bfa, #8b5cf6)',
              }}
            />
            {/* Center marker */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-white/50">
                <span className="font-semibold text-cyan-400 tabular-nums">{positioning.longCount}</span> longs · {formatUsd(positioning.longUsd)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/50">
                {formatUsd(positioning.shortUsd)} · <span className="font-semibold text-violet-400 tabular-nums">{positioning.shortCount}</span> shorts
              </span>
              <span className="w-2 h-2 rounded-full bg-violet-400" />
            </div>
          </div>
          <div className="text-center mt-2 pt-2 border-t border-white/[0.05]">
            <span className="text-[9px] text-white/20 uppercase tracking-wider">Total Exposure </span>
            <span className="text-xs font-semibold text-white/40 tabular-nums">{formatUsd(positioning.total)}</span>
          </div>
        </div>
      </div>

      {/* ─── Liquidation Gravity — Bi-directional ──────────────────────── */}
      <div className="surface-elevated p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
            Liquidation Gravity
          </h3>
          <span className="text-[10px] text-white/20">
            {primaryAsset === 'ALL' ? 'All assets' : primaryAsset} · {currentPrice ? formatPrice(currentPrice) + ' now' : 'price scenarios'}
          </span>
        </div>

        <div className="space-y-1">
          {/* ── Upside shocks (price rises → shorts get liquidated) ── */}
          {upsideGravity.length > 0 && upsideGravity.map(({ shockPct, debtAtRisk, positionCount, priceAtShock }) => {
            const barWidth = maxGravityDebtAll > 0 ? (debtAtRisk / maxGravityDebtAll) * 100 : 0;
            const severity = shockPct <= 10 ? 'high' : shockPct <= 20 ? 'medium' : 'low';

            return (
              <div key={shockPct} className="group flex items-center gap-2">
                <div className="w-24 text-right shrink-0">
                  {priceAtShock ? (
                    <div className="flex flex-col items-end">
                      <span className={`text-[11px] font-bold tabular-nums ${
                        severity === 'high' ? 'text-violet-400' :
                        severity === 'medium' ? 'text-violet-400/70' :
                        'text-white/30'
                      }`}>
                        {formatPrice(priceAtShock)}
                      </span>
                      <span className="text-[8px] text-white/20">+{shockPct}%</span>
                    </div>
                  ) : (
                    <span className={`text-[11px] font-bold tabular-nums ${
                      severity === 'high' ? 'text-violet-400' : 'text-white/30'
                    }`}>
                      +{shockPct}%
                    </span>
                  )}
                </div>
                <span className="text-white/15 text-[10px] shrink-0">→</span>
                <div className="flex-1 h-6 rounded bg-white/[0.03] relative overflow-hidden">
                  {barWidth > 0 && (
                    <div
                      className={`absolute inset-y-0 left-0 rounded transition-all duration-500 ${
                        severity === 'high' ? 'bg-violet-500/40' :
                        severity === 'medium' ? 'bg-violet-500/25' :
                        'bg-white/[0.06]'
                      }`}
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center px-2">
                    {debtAtRisk > 0 ? (
                      <span className={`text-[10px] font-medium tabular-nums ${
                        severity === 'high' ? 'text-white/80' : 'text-white/50'
                      }`}>
                        {formatUsd(debtAtRisk)} shorts liquidated
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/20">no short liquidations</span>
                    )}
                  </div>
                </div>
                <div className="w-12 text-right shrink-0">
                  <span className="text-[9px] text-white/25 tabular-nums">
                    {positionCount > 0 ? `${positionCount} pos` : ''}
                  </span>
                </div>
              </div>
            );
          })}

          {/* ── Current price divider ── */}
          <div className="flex items-center gap-2 py-1">
            <div className="w-24 text-right shrink-0">
              {currentPrice ? (
                <span className="text-[11px] font-bold text-teal-400 tabular-nums">
                  {formatPrice(currentPrice)}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-white/40">now</span>
              )}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-px bg-gradient-to-r from-teal-400/40 to-transparent" />
              <span className="text-[9px] text-teal-400/60 font-semibold uppercase tracking-wider shrink-0">
                current price
              </span>
              <div className="flex-1 h-px bg-gradient-to-l from-teal-400/40 to-transparent" />
            </div>
            <div className="w-12" />
          </div>

          {/* ── Downside shocks (price drops → longs get liquidated) ── */}
          {downsideGravity.map(({ shockPct, debtAtRisk, positionCount, priceAtShock }) => {
            const barWidth = maxGravityDebtAll > 0 ? (debtAtRisk / maxGravityDebtAll) * 100 : 0;
            const severity = Math.abs(shockPct) <= 10 ? 'high' : Math.abs(shockPct) <= 20 ? 'medium' : 'low';

            return (
              <div key={shockPct} className="group flex items-center gap-2">
                <div className="w-24 text-right shrink-0">
                  {priceAtShock ? (
                    <div className="flex flex-col items-end">
                      <span className={`text-[11px] font-bold tabular-nums ${
                        severity === 'high' ? 'text-rose-400' :
                        severity === 'medium' ? 'text-amber-400' :
                        'text-white/30'
                      }`}>
                        {formatPrice(priceAtShock)}
                      </span>
                      <span className="text-[8px] text-white/20">{shockPct}%</span>
                    </div>
                  ) : (
                    <span className={`text-[11px] font-bold tabular-nums ${
                      severity === 'high' ? 'text-rose-400' :
                      severity === 'medium' ? 'text-amber-400' :
                      'text-white/30'
                    }`}>
                      {shockPct}%
                    </span>
                  )}
                </div>
                <span className="text-white/15 text-[10px] shrink-0">→</span>
                <div className="flex-1 h-6 rounded bg-white/[0.03] relative overflow-hidden">
                  {barWidth > 0 && (
                    <div
                      className={`absolute inset-y-0 left-0 rounded transition-all duration-500 ${
                        severity === 'high' ? 'bg-rose-500/40' :
                        severity === 'medium' ? 'bg-amber-500/25' :
                        'bg-white/[0.06]'
                      }`}
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center px-2">
                    {debtAtRisk > 0 ? (
                      <span className={`text-[10px] font-medium tabular-nums ${
                        severity === 'high' ? 'text-white/80' :
                        severity === 'medium' ? 'text-white/60' :
                        'text-white/40'
                      }`}>
                        {formatUsd(debtAtRisk)} longs liquidated
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/20">no long liquidations</span>
                    )}
                  </div>
                </div>
                <div className="w-12 text-right shrink-0">
                  <span className="text-[9px] text-white/25 tabular-nums">
                    {positionCount > 0 ? `${positionCount} pos` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 text-[9px] text-white/20 italic">
          {currentPrice ? (
            <>If {primaryAsset} moves from {formatPrice(currentPrice)} — how much debt becomes liquidatable in each direction</>
          ) : (
            <>Price moves vs liquidation impact — upside hurts shorts, downside hurts longs</>
          )}
        </div>
      </div>

      {/* ─── HOT POSITIONS — THE HERO ──────────────────────────────────── */}
      {hotPositions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-orange-400 to-rose-500" />
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                Hot Positions
              </h3>
              <span className="text-[10px] text-white/20 hidden sm:inline">
                Most notable first
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hotPositions.map((position, idx) => {
              const { direction } = getPositionDirection(position);
              const isLong = direction === 'LONG';
              const leverage = computeLeverage(position);
              const hp = healthPct(position);
              const hColor = healthColor(hp);
              const danger = dangerLevel(position);

              return (
                <button
                  key={position.marginManagerId}
                  onClick={() => onOpenWallet?.(position)}
                  className={`group text-left w-full relative overflow-hidden rounded-xl transition-all duration-200 hover:-translate-y-0.5 ${danger.cardBg} ${danger.cardBorder} border ${danger.glow}`}
                >
                  <div className="p-5">
                    {/* Row 1: Danger level headline + rank */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-lg font-black uppercase tracking-wide ${danger.textColor} ${
                        position.isLiquidatable ? 'animate-pulse' : ''
                      }`}>
                        {danger.label}
                      </span>
                      <span className="text-[9px] font-bold text-white/10">#{idx + 1}</span>
                    </div>

                    {/* Health bar — thick, game-like HP bar */}
                    <div className="relative h-4 rounded-full overflow-hidden bg-white/[0.06] mb-4">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                          hp < 15 ? 'animate-pulse' : ''
                        }`}
                        style={{
                          width: `${Math.max(hp, 2)}%`,
                          background: `linear-gradient(90deg, ${hColor}, ${hColor}dd)`,
                          boxShadow: hp < 30 ? `0 0 12px ${hColor}50` : 'none',
                        }}
                      />
                      {/* Notches at 25%, 50%, 75% */}
                      <div className="absolute inset-0 flex">
                        <div className="w-1/4 border-r border-white/[0.08]" />
                        <div className="w-1/4 border-r border-white/[0.08]" />
                        <div className="w-1/4 border-r border-white/[0.08]" />
                        <div className="w-1/4" />
                      </div>
                    </div>

                    {/* Info line: direction + leverage + asset — size */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                        isLong
                          ? 'bg-cyan-500/15 text-cyan-400'
                          : 'bg-violet-500/15 text-violet-400'
                      }`}>
                        {isLong ? '↗' : '↘'} {leverage.toFixed(1)}x {direction}
                      </span>
                      <span className="text-sm font-semibold text-white/80">
                        {position.baseAssetSymbol}
                      </span>
                      <span className="text-white/15">—</span>
                      <span className="text-sm font-bold text-white tabular-nums">
                        {formatUsd(position.totalDebtUsd)}
                      </span>
                    </div>

                    {/* Footer: wallet address + time open + click hint */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] font-mono text-white/15 group-hover:text-teal-400/40 transition-colors truncate">
                          {formatAddress(position.marginManagerId)}
                        </span>
                        {positionAges.get(position.marginManagerId) && (
                          <span className="text-[9px] text-white/20 shrink-0">
                            · open {formatTimeOpen(positionAges.get(position.marginManagerId)!)}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-teal-400/30 group-hover:text-teal-400 transition-colors shrink-0">
                        View →
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
