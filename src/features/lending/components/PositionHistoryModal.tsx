import React from 'react';
import { type AtRiskPosition } from '../../../hooks/useAtRiskPositions';
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
import {
  HistoryIcon,
  AnchorIcon,
  BorrowingIcon,
  CheckIcon,
  BoltIcon,
} from '../../../components/ThemedIcons';

interface PositionHistoryModalProps {
  position: AtRiskPosition;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Timeline event types
 */
type TimelineEventType = 'created' | 'borrow' | 'repay' | 'liquidation';

interface TimelineEvent {
  type: TimelineEventType;
  timestamp: Date;
  checkpointTimestamp: number;
  digest: string;
  data: {
    amount?: number;
    shares?: number;
    poolId?: string;
    riskRatio?: number;
    reward?: number;
    poolDefault?: number;
  };
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
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * Format native amount
 */
function formatAmount(amount: number, decimals: number = 9): string {
  const normalized = amount / Math.pow(10, decimals);
  if (normalized >= 1000000) return `${(normalized / 1000000).toFixed(2)}M`;
  if (normalized >= 1000) return `${(normalized / 1000).toFixed(2)}K`;
  return normalized.toFixed(2);
}

/**
 * Get event icon and color
 */
function getEventStyle(type: TimelineEventType): { icon: React.ReactNode; color: string; bgColor: string } {
  switch (type) {
    case 'created':
      return { icon: <AnchorIcon size={24} />, color: 'text-cyan-400', bgColor: 'bg-white/5 border-cyan-500/40' };
    case 'borrow':
      return { icon: <BorrowingIcon size={24} />, color: 'text-teal-400', bgColor: 'bg-white/5 border-amber-500/40' };
    case 'repay':
      return { icon: <CheckIcon size={24} />, color: 'text-cyan-400', bgColor: 'bg-white/5 border-cyan-500/40' };
    case 'liquidation':
      return { icon: <BoltIcon size={24} />, color: 'text-rose-400', bgColor: 'bg-white/5 border-rose-500/40' };
  }
}

/**
 * Position History Modal Component
 * Shows the complete history of a margin manager position
 */
export function PositionHistoryModal({
  position,
  isOpen,
  onClose,
}: PositionHistoryModalProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([]);
  const [creationInfo, setCreationInfo] = React.useState<MarginManagerCreatedEventResponse | null>(null);

  // Fetch all events for this margin manager
  React.useEffect(() => {
    if (!isOpen) return;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const managerId = position.marginManagerId;

        // Use very wide time range to capture all events (including testnet future timestamps)
        const wideTimeRange = {
          start_time: 1,                    // Beginning of Unix time
          end_time: 9999999999,             // Far future
          margin_manager_id: managerId,
        };

        // Fetch all event types in parallel
        const [borrows, repays, liquidations, creations] = await Promise.all([
          fetchLoanBorrowed(wideTimeRange),
          fetchLoanRepaid(wideTimeRange),
          fetchLiquidations(wideTimeRange),
          fetchMarginManagerCreated(wideTimeRange),
        ]);

        // Get creation info
        if (creations.length > 0) {
          setCreationInfo(creations[0]);
        }

        // Build timeline
        const events: TimelineEvent[] = [];

        // Add creation event
        creations.forEach((event) => {
          events.push({
            type: 'created',
            timestamp: new Date(event.checkpoint_timestamp_ms),
            checkpointTimestamp: event.checkpoint_timestamp_ms,
            digest: event.digest,
            data: {},
          });
        });

        // Add borrow events
        borrows.forEach((event: LoanBorrowedEventResponse) => {
          events.push({
            type: 'borrow',
            timestamp: new Date(event.checkpoint_timestamp_ms),
            checkpointTimestamp: event.checkpoint_timestamp_ms,
            digest: event.digest,
            data: {
              amount: parseFloat(event.loan_amount),
              shares: parseFloat(event.loan_shares),
              poolId: event.margin_pool_id,
            },
          });
        });

        // Add repay events
        repays.forEach((event: LoanRepaidEventResponse) => {
          events.push({
            type: 'repay',
            timestamp: new Date(event.checkpoint_timestamp_ms),
            checkpointTimestamp: event.checkpoint_timestamp_ms,
            digest: event.digest,
            data: {
              amount: parseFloat(event.repay_amount),
              shares: parseFloat(event.repay_shares),
              poolId: event.margin_pool_id,
            },
          });
        });

        // Add liquidation events
        liquidations.forEach((event: LiquidationEventResponse) => {
          events.push({
            type: 'liquidation',
            timestamp: new Date(event.checkpoint_timestamp_ms),
            checkpointTimestamp: event.checkpoint_timestamp_ms,
            digest: event.digest,
            data: {
              amount: parseFloat(event.liquidation_amount),
              riskRatio: parseFloat(event.risk_ratio) / 1e9,
              reward: parseFloat(event.pool_reward),
              poolDefault: parseFloat(event.pool_default),
              poolId: event.margin_pool_id,
            },
          });
        });

        // Sort by timestamp (newest first)
        events.sort((a, b) => b.checkpointTimestamp - a.checkpointTimestamp);

        setTimeline(events);
      } catch (err) {
        console.error('Error fetching position history:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [isOpen, position.marginManagerId]);

  // Calculate totals
  const totals = React.useMemo(() => {
    let totalBorrowed = 0;
    let totalRepaid = 0;
    let totalLiquidated = 0;

    timeline.forEach((event) => {
      if (event.type === 'borrow' && event.data.amount) {
        totalBorrowed += event.data.amount;
      }
      if (event.type === 'repay' && event.data.amount) {
        totalRepaid += event.data.amount;
      }
      if (event.type === 'liquidation' && event.data.amount) {
        totalLiquidated += event.data.amount;
      }
    });

    return { totalBorrowed, totalRepaid, totalLiquidated };
  }, [timeline]);

  // Calculate position age
  const positionAge = React.useMemo(() => {
    const creationEvent = timeline.find((e) => e.type === 'created');
    if (!creationEvent) return null;
    
    const ageMs = Date.now() - creationEvent.timestamp.getTime();
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ageMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  }, [timeline]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative rounded-2xl border border-cyan-500/20 w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl" style={{ background: 'linear-gradient(180deg, #0c1a24 0%, #0a1419 100%)' }}>
        {/* Header */}
        <div className="sticky top-0 border-b border-cyan-500/20 p-6 z-10" style={{ background: 'rgba(12, 26, 36, 0.95)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-cyan-100 flex items-center gap-2">
                <HistoryIcon size={24} />
                Position History
              </h2>
              <a
                href={`https://suivision.xyz/object/${position.marginManagerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cyan-400 hover:text-cyan-300 font-mono mt-1 inline-block"
              >
                {formatAddress(position.marginManagerId)} ↗
              </a>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-cyan-200/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current State Summary */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-cyan-900/30 rounded-lg p-3 border border-cyan-500/10">
              <div className="text-xs text-cyan-200/60">Risk Ratio</div>
              <div className={`text-lg font-bold ${
                position.isLiquidatable ? 'text-rose-400' :
                position.distanceToLiquidation < 5 ? 'text-teal-400' :
                position.distanceToLiquidation < 15 ? 'text-teal-300' :
                'text-cyan-400'
              }`}>
                {position.riskRatio.toFixed(4)}
              </div>
            </div>
            <div className="bg-cyan-900/30 rounded-lg p-3 border border-cyan-500/10">
              <div className="text-xs text-cyan-200/60">Total Debt</div>
              <div className="text-lg font-bold text-cyan-100">
                {formatUsd(position.totalDebtUsd)}
              </div>
            </div>
            <div className="bg-cyan-900/30 rounded-lg p-3 border border-cyan-500/10">
              <div className="text-xs text-cyan-200/60">Distance to Liq</div>
              <div className={`text-lg font-bold ${
                position.distanceToLiquidation < 0 ? 'text-rose-400' :
                position.distanceToLiquidation < 5 ? 'text-teal-400' :
                position.distanceToLiquidation < 15 ? 'text-teal-300' :
                'text-cyan-400'
              }`}>
                {position.distanceToLiquidation > 0 ? '+' : ''}{position.distanceToLiquidation.toFixed(1)}%
              </div>
            </div>
            <div className="bg-cyan-900/30 rounded-lg p-3 border border-cyan-500/10">
              <div className="text-xs text-cyan-200/60">Position Age</div>
              <div className="text-lg font-bold text-cyan-100">
                {positionAge || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">
              Error loading history: {error.message}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Activity Summary */}
              <div className="bg-cyan-900/20 rounded-xl p-4 border border-cyan-500/20">
                <h3 className="text-sm font-semibold text-cyan-100/80 mb-3">Activity Summary</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-cyan-100">{timeline.length}</div>
                    <div className="text-xs text-cyan-200/60">Total Events</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-teal-400">
                      {timeline.filter(e => e.type === 'borrow').length}
                    </div>
                    <div className="text-xs text-cyan-200/60">Borrows</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {timeline.filter(e => e.type === 'repay').length}
                    </div>
                    <div className="text-xs text-cyan-200/60">Repays</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-rose-400">
                      {timeline.filter(e => e.type === 'liquidation').length}
                    </div>
                    <div className="text-xs text-cyan-200/60">Liquidations</div>
                  </div>
                </div>

                {/* Volume Totals */}
                <div className="mt-4 pt-4 border-t border-cyan-500/20">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-cyan-200/60">Total Borrowed: </span>
                      <span className="font-semibold text-teal-400">{formatAmount(totals.totalBorrowed)}</span>
                    </div>
                    <div>
                      <span className="text-cyan-200/60">Total Repaid: </span>
                      <span className="font-semibold text-cyan-400">{formatAmount(totals.totalRepaid)}</span>
                    </div>
                    <div>
                      <span className="text-cyan-200/60">Total Liquidated: </span>
                      <span className="font-semibold text-rose-400">{formatAmount(totals.totalLiquidated)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Position Breakdown */}
              <div className="bg-cyan-900/20 rounded-xl p-4 border border-cyan-500/20">
                <h3 className="text-sm font-semibold text-cyan-100/80 mb-3">Current Position Breakdown</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Collateral */}
                  <div>
                    <div className="text-xs text-cyan-200/60 uppercase tracking-wider mb-2">Collateral</div>
                    <div className="space-y-2">
                      {position.baseAsset > 0 && (
                        <div className="flex justify-between">
                          <span className="text-cyan-200/70">{position.baseAssetSymbol}</span>
                          <span className="font-semibold text-cyan-100">
                            {formatAmount(position.baseAsset)} ({formatUsd(position.baseAssetUsd)})
                          </span>
                        </div>
                      )}
                      {position.quoteAsset > 0 && (
                        <div className="flex justify-between">
                          <span className="text-cyan-200/70">{position.quoteAssetSymbol}</span>
                          <span className="font-semibold text-cyan-100">
                            {formatAmount(position.quoteAsset, 6)} ({formatUsd(position.quoteAssetUsd)})
                          </span>
                        </div>
                      )}
                      {position.baseAsset === 0 && position.quoteAsset === 0 && (
                        <div className="text-cyan-200/40 text-sm">No collateral</div>
                      )}
                    </div>
                  </div>

                  {/* Debt */}
                  <div>
                    <div className="text-xs text-cyan-200/60 uppercase tracking-wider mb-2">Debt</div>
                    <div className="space-y-2">
                      {position.baseDebt > 0 && (
                        <div className="flex justify-between">
                          <span className="text-cyan-200/70">{position.baseAssetSymbol}</span>
                          <span className="font-semibold text-teal-400">
                            {formatAmount(position.baseDebt)} ({formatUsd(position.baseDebtUsd)})
                          </span>
                        </div>
                      )}
                      {position.quoteDebt > 0 && (
                        <div className="flex justify-between">
                          <span className="text-cyan-200/70">{position.quoteAssetSymbol}</span>
                          <span className="font-semibold text-teal-400">
                            {formatAmount(position.quoteDebt, 6)} ({formatUsd(position.quoteDebtUsd)})
                          </span>
                        </div>
                      )}
                      {position.baseDebt === 0 && position.quoteDebt === 0 && (
                        <div className="text-cyan-200/40 text-sm">No debt</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-100/80 mb-3">Event Timeline</h3>
                {timeline.length === 0 ? (
                  <div className="text-center py-8 text-cyan-200/60">
                    No events found for this position
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timeline.map((event, index) => {
                      const style = getEventStyle(event.type);
                      return (
                        <div
                          key={index}
                          className={`rounded-lg p-4 border ${style.bgColor} transition-all hover:bg-white/5`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">{style.icon}</div>
                              <div>
                                <div className={`font-semibold capitalize ${style.color}`}>
                                  {event.type === 'created' ? 'Position Created' :
                                   event.type === 'borrow' ? 'Loan Borrowed' :
                                   event.type === 'repay' ? 'Loan Repaid' :
                                   'Liquidation'}
                                </div>
                                <div className="text-xs text-cyan-200/60">
                                  {event.timestamp.toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <a
                              href={`https://suivision.xyz/txblock/${event.digest}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-400 hover:text-cyan-300"
                            >
                              View Tx ↗
                            </a>
                          </div>

                          {/* Event-specific details */}
                          {event.data.amount !== undefined && (
                            <div className="mt-3 pt-3 border-t border-cyan-500/20 text-sm">
                              <div className="flex flex-wrap gap-4">
                                <div>
                                  <span className="text-cyan-200/60">Amount: </span>
                                  <span className="font-semibold text-cyan-100">
                                    {formatAmount(event.data.amount)}
                                  </span>
                                </div>
                                {event.data.riskRatio !== undefined && (
                                  <div>
                                    <span className="text-cyan-200/60">Risk Ratio: </span>
                                    <span className="font-semibold text-rose-400">
                                      {event.data.riskRatio.toFixed(4)}
                                    </span>
                                  </div>
                                )}
                                {event.data.reward !== undefined && (
                                  <div>
                                    <span className="text-cyan-200/60">Reward: </span>
                                    <span className="font-semibold text-cyan-400">
                                      {formatAmount(event.data.reward)}
                                    </span>
                                  </div>
                                )}
                                {event.data.poolDefault !== undefined && event.data.poolDefault > 0 && (
                                  <div>
                                    <span className="text-cyan-200/60">Bad Debt: </span>
                                    <span className="font-semibold text-rose-400">
                                      {formatAmount(event.data.poolDefault)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-cyan-500/20 p-4" style={{ background: 'rgba(12, 26, 36, 0.95)' }}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-cyan-200/40">
              Last updated: {position.updatedAt.toLocaleString()}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-sm font-medium text-cyan-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

