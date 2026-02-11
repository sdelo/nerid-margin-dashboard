import React from 'react';
import { type AtRiskPosition, getPositionDirection } from '../../../hooks/useAtRiskPositions';
import {
  fetchLoanBorrowed,
  fetchLoanRepaid,
  fetchLiquidations,
  type LoanBorrowedEventResponse,
  type LoanRepaidEventResponse,
  type LiquidationEventResponse,
} from '../api/events';

interface WalletDrawerProps {
  position: AtRiskPosition | null;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  if (value > 0) return '<$1';
  return '$0';
}

function formatAmount(value: number, symbol: string): string {
  const decimals = value >= 1000 ? 1 : value >= 1 ? 3 : 6;
  return `${value.toFixed(decimals)} ${symbol}`;
}

function formatAddress(address: string): string {
  if (!address || address.length < 16) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toFixed(0)}`;
  if (value >= 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(5)}`;
}

// ─── Token Decimals & Amount Humanization ────────────────────────────────────

/**
 * Get native token decimals for on-chain amount conversion
 */
function getTokenDecimals(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s === 'SUI' || s === 'WAL') return 9;
  if (s === 'USDC' || s === 'DEEP') return 6;
  return 9; // default
}

/**
 * Resolve which asset an event relates to by matching its pool ID
 * to the position's base or quote margin pool.
 */
function resolveEventAsset(
  poolId: string,
  position: AtRiskPosition | null,
): { symbol: string; decimals: number; price: number; pythDecimals: number } | null {
  if (!position) return null;
  if (poolId === position.baseMarginPoolId) {
    return {
      symbol: position.baseAssetSymbol,
      decimals: getTokenDecimals(position.baseAssetSymbol),
      price: position.basePythPrice,
      pythDecimals: position.basePythDecimals,
    };
  }
  if (poolId === position.quoteMarginPoolId) {
    return {
      symbol: position.quoteAssetSymbol,
      decimals: getTokenDecimals(position.quoteAssetSymbol),
      price: position.quotePythPrice,
      pythDecimals: position.quotePythDecimals,
    };
  }
  return null;
}

/**
 * Convert a raw on-chain amount to human-readable token + USD display
 */
function humanizeEventAmount(
  rawAmount: string,
  poolId: string,
  position: AtRiskPosition | null,
): { tokenDisplay: string; usdDisplay: string | null } {
  const asset = resolveEventAsset(poolId, position);
  if (!asset) {
    // Fallback: just format the raw number
    const raw = parseFloat(rawAmount);
    if (isNaN(raw) || raw === 0) return { tokenDisplay: '—', usdDisplay: null };
    if (raw >= 1e9) return { tokenDisplay: `${(raw / 1e9).toFixed(2)}B`, usdDisplay: null };
    if (raw >= 1e6) return { tokenDisplay: `${(raw / 1e6).toFixed(2)}M`, usdDisplay: null };
    return { tokenDisplay: raw.toLocaleString(undefined, { maximumFractionDigits: 2 }), usdDisplay: null };
  }

  const tokenAmount = parseFloat(rawAmount) / Math.pow(10, asset.decimals);
  if (isNaN(tokenAmount) || tokenAmount === 0) return { tokenDisplay: '—', usdDisplay: null };

  // Token display
  let tokenDisplay: string;
  if (tokenAmount >= 1_000_000) tokenDisplay = `${(tokenAmount / 1_000_000).toFixed(2)}M ${asset.symbol}`;
  else if (tokenAmount >= 1_000) tokenDisplay = `${(tokenAmount / 1_000).toFixed(1)}K ${asset.symbol}`;
  else if (tokenAmount >= 1) tokenDisplay = `${tokenAmount.toFixed(2)} ${asset.symbol}`;
  else tokenDisplay = `${tokenAmount.toFixed(4)} ${asset.symbol}`;

  // USD conversion using current Pyth price
  const usdPrice = asset.price / Math.pow(10, Math.abs(asset.pythDecimals));
  const usdValue = tokenAmount * usdPrice;
  const usdDisplay = usdValue > 0.01 ? formatUsd(usdValue) : null;

  return { tokenDisplay, usdDisplay };
}

// ─── Timeline Event Types ───────────────────────────────────────────────────

type TimelineEventType = 'borrow' | 'repay' | 'liquidation';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: number;
  amount: string;
  poolId: string;
  details: Record<string, string>;
  txDigest: string;
}

function eventTypeConfig(type: TimelineEventType) {
  switch (type) {
    case 'borrow':
      return {
        label: 'Borrowed',
        icon: '↗',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/15',
        border: 'border-cyan-500/20',
      };
    case 'repay':
      return {
        label: 'Repaid',
        icon: '↙',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/20',
      };
    case 'liquidation':
      return {
        label: 'Liquidated',
        icon: '⚡',
        color: 'text-rose-400',
        bg: 'bg-rose-500/15',
        border: 'border-rose-500/20',
      };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WalletDrawer({ position, isOpen, onClose }: WalletDrawerProps) {
  const [events, setEvents] = React.useState<TimelineEvent[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);
  const [eventCounts, setEventCounts] = React.useState({ borrows: 0, repays: 0, liquidations: 0 });
  const drawerRef = React.useRef<HTMLDivElement>(null);

  const marginManagerId = position?.marginManagerId;

  // Close on Escape
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Fetch event history for this wallet
  React.useEffect(() => {
    async function fetchHistory() {
      if (!marginManagerId) return;
      setEventsLoading(true);
      try {
        const [borrowEvents, repayEvents, liqEvents] = await Promise.all([
          fetchLoanBorrowed({ margin_manager_id: marginManagerId, limit: 50 }),
          fetchLoanRepaid({ margin_manager_id: marginManagerId, limit: 50 }),
          fetchLiquidations({ margin_manager_id: marginManagerId, limit: 50 }),
        ]);

        setEventCounts({
          borrows: borrowEvents.length,
          repays: repayEvents.length,
          liquidations: liqEvents.length,
        });

        const timeline: TimelineEvent[] = [];

        borrowEvents.forEach((e: LoanBorrowedEventResponse) => {
          timeline.push({
            id: e.event_digest + '_borrow',
            type: 'borrow',
            timestamp: e.onchain_timestamp * 1000,
            amount: e.loan_amount,
            poolId: e.margin_pool_id,
            details: { shares: e.loan_shares },
            txDigest: e.digest,
          });
        });

        repayEvents.forEach((e: LoanRepaidEventResponse) => {
          timeline.push({
            id: e.event_digest + '_repay',
            type: 'repay',
            timestamp: e.onchain_timestamp * 1000,
            amount: e.repay_amount,
            poolId: e.margin_pool_id,
            details: { shares: e.repay_shares },
            txDigest: e.digest,
          });
        });

        liqEvents.forEach((e: LiquidationEventResponse) => {
          timeline.push({
            id: e.event_digest + '_liq',
            type: 'liquidation',
            timestamp: e.onchain_timestamp * 1000,
            amount: e.liquidation_amount,
            poolId: e.margin_pool_id,
            details: {
              pool_reward: e.pool_reward,
              pool_default: e.pool_default,
              risk_ratio: e.risk_ratio,
            },
            txDigest: e.digest,
          });
        });

        timeline.sort((a, b) => b.timestamp - a.timestamp);
        setEvents(timeline);
      } catch (err) {
        console.error('Error fetching wallet history:', err);
      } finally {
        setEventsLoading(false);
      }
    }

    if (marginManagerId && isOpen) {
      fetchHistory();
    }
  }, [marginManagerId, isOpen]);

  if (!isOpen) return null;

  const direction = position ? getPositionDirection(position) : null;
  const currentBasePrice = position
    ? position.basePythPrice / Math.pow(10, Math.abs(position.basePythDecimals))
    : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.15s ease-out' }}
      />

      {/* Modal — centered on the page */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 sm:py-12"
        onClick={onClose}
      >
        <div
          ref={drawerRef}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl rounded-2xl border border-white/[0.08] shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #0f1e26 0%, #0b161c 100%)',
            animation: 'modalEnter 0.2s ease-out',
          }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 px-6 py-4 border-b border-white/[0.06] rounded-t-2xl" style={{ background: 'rgba(15,30,38,0.97)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-base font-semibold text-white truncate">Wallet Detail</h2>
                {direction && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded shrink-0 ${
                    direction.direction === 'LONG'
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'bg-violet-500/15 text-violet-400'
                  }`}>
                    {direction.direction === 'LONG' ? '↗' : '↘'} {direction.direction}
                  </span>
                )}
                {position?.isLiquidatable && (
                  <span className="badge badge-danger text-[9px] shrink-0">LIQ</span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70 shrink-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ID + external links */}
            {marginManagerId && (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-white/25 truncate">{marginManagerId}</span>
                <a
                  href={`https://suivision.xyz/object/${marginManagerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-teal-400/60 hover:text-teal-400 transition-colors shrink-0"
                >
                  suivision ↗
                </a>
              </div>
            )}
          </div>

          <div className="px-6 py-5 space-y-4">
          {/* ─── Risk Metrics ─────────────────────────────────────────── */}
          {position && (
            <div className="grid grid-cols-3 gap-3">
              <div className="surface-metric text-center">
                <div className={`text-lg font-bold tabular-nums ${
                  position.isLiquidatable ? 'text-rose-400' :
                  position.distanceToLiquidation < 10 ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>
                  {position.riskRatio.toFixed(3)}
                </div>
                <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Risk Ratio</div>
              </div>
              <div className="surface-metric text-center">
                <div className={`text-lg font-bold tabular-nums ${
                  position.isLiquidatable ? 'text-rose-400' :
                  position.distanceToLiquidation < 10 ? 'text-amber-400' :
                  position.distanceToLiquidation < 25 ? 'text-teal-400' :
                  'text-emerald-400'
                }`}>
                  {position.isLiquidatable ? 'LIQ' : `+${position.distanceToLiquidation.toFixed(1)}%`}
                </div>
                <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Buffer</div>
              </div>
              <div className="surface-metric text-center">
                <div className="text-lg font-bold text-white tabular-nums">
                  {formatUsd(position.totalDebtUsd)}
                </div>
                <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Debt</div>
              </div>
            </div>
          )}

          {/* ─── Collateral vs Debt ──────────────────────────────────── */}
          {position && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Position Breakdown</h3>
              
              {/* Pair */}
              <div className="text-xs text-white/60 mb-2">
                {position.baseAssetSymbol}/{position.quoteAssetSymbol}
                {currentBasePrice > 0 && (
                  <span className="text-white/30 ml-2">· {position.baseAssetSymbol} @ {formatPrice(currentBasePrice)}</span>
                )}
              </div>

              {/* Assets row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Base */}
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/40">{position.baseAssetSymbol}</span>
                    <span className="text-[9px] text-emerald-400/60">collateral</span>
                  </div>
                  <div className="text-sm font-bold text-white tabular-nums">{formatUsd(position.baseAssetUsd)}</div>
                  <div className="text-[10px] text-white/25 tabular-nums">{formatAmount(position.baseAsset, '')}</div>
                  {position.baseDebtUsd > 0.01 && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-rose-400/60">debt</span>
                        <span className="text-[10px] font-bold text-rose-400 tabular-nums">{formatUsd(position.baseDebtUsd)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quote */}
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/40">{position.quoteAssetSymbol}</span>
                    <span className="text-[9px] text-emerald-400/60">collateral</span>
                  </div>
                  <div className="text-sm font-bold text-white tabular-nums">{formatUsd(position.quoteAssetUsd)}</div>
                  <div className="text-[10px] text-white/25 tabular-nums">{formatAmount(position.quoteAsset, '')}</div>
                  {position.quoteDebtUsd > 0.01 && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-rose-400/60">debt</span>
                        <span className="text-[10px] font-bold text-rose-400 tabular-nums">{formatUsd(position.quoteDebtUsd)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Net summary row */}
              <div className="flex items-center justify-between px-1 py-2">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[9px] text-white/30 uppercase">Collateral</span>
                    <div className="text-xs font-bold text-emerald-400 tabular-nums">{formatUsd(position.baseAssetUsd + position.quoteAssetUsd)}</div>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/30 uppercase">Debt</span>
                    <div className="text-xs font-bold text-rose-400 tabular-nums">{formatUsd(position.totalDebtUsd)}</div>
                  </div>
                </div>
                {direction && (
                  <div className="text-right">
                    <span className="text-[9px] text-white/30 uppercase">Net Exposure</span>
                    <div className={`text-xs font-bold tabular-nums ${direction.direction === 'LONG' ? 'text-cyan-400' : 'text-violet-400'}`}>
                      {formatUsd(Math.abs(direction.netExposureUsd))} {direction.direction.toLowerCase()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Quick Stats ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5 text-center">
              <div className="text-sm font-bold text-cyan-400 tabular-nums">{eventCounts.borrows}</div>
              <div className="text-[9px] text-white/30 uppercase tracking-wider">Borrows</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5 text-center">
              <div className="text-sm font-bold text-emerald-400 tabular-nums">{eventCounts.repays}</div>
              <div className="text-[9px] text-white/30 uppercase tracking-wider">Repays</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5 text-center">
              <div className="text-sm font-bold text-rose-400 tabular-nums">{eventCounts.liquidations}</div>
              <div className="text-[9px] text-white/30 uppercase tracking-wider">Liquidations</div>
            </div>
          </div>

          {/* ─── Position Age & Track Record ────────────────────────── */}
          {events.length > 0 && (
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
              <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Track Record</h3>
              <div className="space-y-1.5">
                {/* Position opened */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30">First activity</span>
                  <span className="text-xs text-white/60 tabular-nums">
                    {formatTimestamp(events[events.length - 1].timestamp)}
                  </span>
                </div>
                {/* Activity summary */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30">Total events</span>
                  <span className="text-xs text-white/60 tabular-nums">
                    {events.length} ({eventCounts.borrows} borrows, {eventCounts.repays} repays{eventCounts.liquidations > 0 ? `, ${eventCounts.liquidations} liqs` : ''})
                  </span>
                </div>
                {/* Liquidation history */}
                {eventCounts.liquidations > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30">Past liquidations</span>
                    <span className="text-xs text-rose-400 tabular-nums font-semibold">
                      {eventCounts.liquidations}×
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Position Details ─────────────────────────────────────── */}
          {position && (
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
              <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-white/25 uppercase">Liq Threshold</div>
                  <div className="text-xs font-bold text-white/60 tabular-nums">{position.liquidationThreshold.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-white/25 uppercase">Est. Reward</div>
                  <div className="text-xs font-bold text-amber-400 tabular-nums">{formatUsd(position.estimatedRewardUsd)}</div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Event Timeline ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-400">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Event Timeline
              </h3>
              <span className="text-[9px] text-white/20">
                {events.length} event{events.length !== 1 ? 's' : ''}
              </span>
            </div>

            {eventsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-white/30 text-xs">No events found</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {events.map((event, idx) => {
                  const config = eventTypeConfig(event.type);
                  const isLast = idx === events.length - 1;

                  return (
                    <div key={event.id} className="flex gap-2.5 group">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center shrink-0 w-5">
                        <div className={`w-5 h-5 rounded-full ${config.bg} flex items-center justify-center text-[10px] ${config.color} shrink-0`}>
                          {config.icon}
                        </div>
                        {!isLast && (
                          <div className="w-px flex-1 bg-white/[0.06] my-0.5" />
                        )}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 pb-2.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold ${config.color}`}>
                              {config.label}
                            </span>
                            <span className="text-[10px] text-white/15">·</span>
                            <span className="text-[9px] text-white/25">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                          <a
                            href={`https://suiscan.xyz/mainnet/tx/${event.txDigest}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[8px] text-white/15 hover:text-teal-400 transition-colors font-mono"
                          >
                            tx ↗
                          </a>
                        </div>
                        {(() => {
                          const humanized = humanizeEventAmount(event.amount, event.poolId, position);
                          return (
                            <>
                              <div className="text-xs text-white/60 tabular-nums">
                                {humanized.tokenDisplay}
                                {humanized.usdDisplay && (
                                  <span className="text-white/30 ml-1.5">~{humanized.usdDisplay}</span>
                                )}
                              </div>
                              {event.type === 'liquidation' && event.details.risk_ratio && (
                                <div className="text-[9px] text-white/20 mt-0.5">
                                  Risk ratio at liq: {parseFloat(event.details.risk_ratio).toFixed(4)}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* No position state */}
          {!position && (
            <div className="py-8 text-center">
              <p className="text-white/30 text-sm">Position data not available</p>
              <p className="text-white/20 text-xs mt-1">This wallet may have closed all positions</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </>
  );
}
