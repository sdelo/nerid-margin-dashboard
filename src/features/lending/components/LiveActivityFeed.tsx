import React from 'react';
import {
  fetchLoanBorrowed,
  fetchLoanRepaid,
  fetchLiquidations,
  fetchMarginManagerCreated,
  type LoanBorrowedEventResponse,
  type LoanRepaidEventResponse,
  type LiquidationEventResponse,
  type MarginManagerCreatedEventResponse,
} from '../api/events';
import type { AtRiskPosition } from '../../../hooks/useAtRiskPositions';

interface LiveActivityFeedProps {
  /** Pass positions to resolve pool IDs → asset symbols */
  positions: AtRiskPosition[];
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ActivityType = 'borrow' | 'repay' | 'liquidation' | 'new_position';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  timestamp: number;
  rawAmount: string;
  poolId: string;
  walletId: string;
  txDigest: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function formatAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function getTokenDecimals(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s === 'SUI' || s === 'WAL') return 9;
  if (s === 'USDC' || s === 'DEEP') return 6;
  return 9;
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(0)}`;
  return '<$1';
}

const TYPE_CONFIG = {
  borrow: { icon: '↗', label: 'Borrowed', color: 'text-cyan-400', dotBg: 'bg-cyan-400' },
  repay: { icon: '↙', label: 'Repaid', color: 'text-emerald-400', dotBg: 'bg-emerald-400' },
  liquidation: { icon: '⚡', label: 'Liquidated', color: 'text-rose-400', dotBg: 'bg-rose-400' },
  new_position: { icon: '◆', label: 'Opened', color: 'text-amber-400', dotBg: 'bg-amber-400' },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export function LiveActivityFeed({ positions }: LiveActivityFeedProps) {
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);

  // Build a pool-id → { symbol, decimals, price, pythDecimals } lookup from positions
  const poolLookup = React.useMemo(() => {
    const map = new Map<string, { symbol: string; decimals: number; price: number; pythDecimals: number }>();
    positions.forEach(p => {
      if (p.baseMarginPoolId) {
        map.set(p.baseMarginPoolId, {
          symbol: p.baseAssetSymbol,
          decimals: getTokenDecimals(p.baseAssetSymbol),
          price: p.basePythPrice,
          pythDecimals: p.basePythDecimals,
        });
      }
      if (p.quoteMarginPoolId) {
        map.set(p.quoteMarginPoolId, {
          symbol: p.quoteAssetSymbol,
          decimals: getTokenDecimals(p.quoteAssetSymbol),
          price: p.quotePythPrice,
          pythDecimals: p.quotePythDecimals,
        });
      }
    });
    return map;
  }, [positions]);

  // Humanize amount using pool lookup
  const humanizeAmount = React.useCallback((rawAmount: string, poolId: string): string => {
    const asset = poolLookup.get(poolId);
    if (!asset) return '';

    const tokenAmount = parseFloat(rawAmount) / Math.pow(10, asset.decimals);
    if (isNaN(tokenAmount) || tokenAmount === 0) return '';

    const usdPrice = asset.price / Math.pow(10, Math.abs(asset.pythDecimals));
    const usdValue = tokenAmount * usdPrice;

    if (usdValue > 0.01) return formatUsd(usdValue);

    // Fall back to token display
    if (tokenAmount >= 1_000) return `${(tokenAmount / 1_000).toFixed(1)}K ${asset.symbol}`;
    return `${tokenAmount.toFixed(2)} ${asset.symbol}`;
  }, [poolLookup]);

  const fetchActivity = React.useCallback(async () => {
    try {
      const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

      const [borrows, repays, liqs, newPositions] = await Promise.all([
        fetchLoanBorrowed({ limit: 20, start_time: oneDayAgo }),
        fetchLoanRepaid({ limit: 20, start_time: oneDayAgo }),
        fetchLiquidations({ limit: 20, start_time: oneDayAgo }),
        fetchMarginManagerCreated({ limit: 10, start_time: oneDayAgo }),
      ]);

      const merged: ActivityEvent[] = [];

      borrows.forEach((e: LoanBorrowedEventResponse) => {
        merged.push({
          id: e.event_digest + '_b',
          type: 'borrow',
          timestamp: e.onchain_timestamp * 1000,
          rawAmount: e.loan_amount,
          poolId: e.margin_pool_id,
          walletId: e.margin_manager_id,
          txDigest: e.digest,
        });
      });

      repays.forEach((e: LoanRepaidEventResponse) => {
        merged.push({
          id: e.event_digest + '_r',
          type: 'repay',
          timestamp: e.onchain_timestamp * 1000,
          rawAmount: e.repay_amount,
          poolId: e.margin_pool_id,
          walletId: e.margin_manager_id,
          txDigest: e.digest,
        });
      });

      liqs.forEach((e: LiquidationEventResponse) => {
        merged.push({
          id: e.event_digest + '_l',
          type: 'liquidation',
          timestamp: e.onchain_timestamp * 1000,
          rawAmount: e.liquidation_amount,
          poolId: e.margin_pool_id,
          walletId: e.margin_manager_id,
          txDigest: e.digest,
        });
      });

      newPositions.forEach((e: MarginManagerCreatedEventResponse) => {
        merged.push({
          id: e.event_digest + '_n',
          type: 'new_position',
          timestamp: e.onchain_timestamp * 1000,
          rawAmount: '0',
          poolId: '',
          walletId: e.margin_manager_id,
          txDigest: e.digest,
        });
      });

      merged.sort((a, b) => b.timestamp - a.timestamp);
      setEvents(merged.slice(0, 25));
    } catch (err) {
      console.error('Error fetching activity feed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 30_000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  if (isLoading && events.length === 0) {
    return (
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
        <div className="h-6 bg-white/[0.03] rounded animate-pulse" />
      </div>
    );
  }

  if (events.length === 0) return null;

  const visibleEvents = expanded ? events : events.slice(0, 5);
  const hasMore = events.length > 5;

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.03]">
        <div className="flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
          </span>
          <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">
            Live Activity
          </span>
        </div>
        <span className="text-[9px] text-white/15">last 24h</span>
      </div>

      {/* Events */}
      <div className="divide-y divide-white/[0.02]">
        {visibleEvents.map(event => {
          const config = TYPE_CONFIG[event.type];
          const amount = event.type !== 'new_position'
            ? humanizeAmount(event.rawAmount, event.poolId)
            : '';

          return (
            <div
              key={event.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.015] transition-colors group"
            >
              {/* Type dot */}
              <span className={`w-1.5 h-1.5 rounded-full ${config.dotBg} shrink-0 opacity-70`} />

              {/* Label */}
              <span className={`text-[10px] font-semibold ${config.color} w-[60px] shrink-0`}>
                {config.label}
              </span>

              {/* Amount (if available) */}
              {amount && (
                <span className="text-[10px] text-white/50 font-semibold tabular-nums shrink-0">
                  {amount}
                </span>
              )}

              {/* Wallet */}
              <span className="text-[10px] text-white/15 font-mono truncate flex-1">
                {formatAddr(event.walletId)}
              </span>

              {/* TX link (hover) */}
              <a
                href={`https://suiscan.xyz/mainnet/tx/${event.txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] text-white/0 group-hover:text-white/20 hover:!text-teal-400 transition-colors font-mono shrink-0"
              >
                tx↗
              </a>

              {/* Time ago */}
              <span className="text-[9px] text-white/15 tabular-nums w-6 text-right shrink-0">
                {formatTimeAgo(event.timestamp)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Expand/collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-1 text-[9px] text-white/20 hover:text-white/40 transition-colors border-t border-white/[0.02] text-center"
        >
          {expanded ? 'Show less' : `Show ${events.length - 5} more`}
        </button>
      )}
    </div>
  );
}
