import React from "react";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLoanBorrowed,
  fetchLoanRepaid,
  fetchLiquidations,
  type AssetSuppliedEventResponse,
  type AssetWithdrawnEventResponse,
  type LoanBorrowedEventResponse,
  type LoanRepaidEventResponse,
  type LiquidationEventResponse,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import {
  ErrorIcon,
} from "../../../components/ThemedIcons";
import type { PoolOverview } from "../types";

interface UnifiedEventFeedProps {
  pool: PoolOverview;
}

type EventType = "supply" | "withdraw" | "borrow" | "repay" | "liquidation";

interface UnifiedEvent {
  id: string;
  type: EventType;
  timestamp: number;
  amount: number;
  address: string; // supplier or margin_manager_id
  txDigest: string;
  // Additional fields for liquidations
  poolReward?: number;
  poolDefault?: number;
  riskRatio?: number;
}

const EVENT_COLORS: Record<EventType, { bg: string; text: string; border: string }> = {
  supply: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" },
  withdraw: { bg: "bg-slate-500/10", text: "text-slate-300", border: "border-slate-500/20" },
  borrow: { bg: "bg-slate-500/10", text: "text-slate-300", border: "border-slate-500/20" },
  repay: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" },
  liquidation: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
};

const EVENT_LABELS: Record<EventType, string> = {
  supply: "Supply",
  withdraw: "Withdraw",
  borrow: "Borrow",
  repay: "Repay",
  liquidation: "Liquidation",
};

const EVENT_ICONS: Record<EventType, string> = {
  supply: "↓",
  withdraw: "↑",
  borrow: "→",
  repay: "←",
  liquidation: "!",
};

export function UnifiedEventFeed({ pool }: UnifiedEventFeedProps) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1W");
  const [events, setEvents] = React.useState<UnifiedEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [filters, setFilters] = React.useState<Set<EventType>>(
    new Set(["supply", "withdraw", "borrow", "repay", "liquidation"])
  );
  const [showCount, setShowCount] = React.useState(50);

  const decimals = pool.contracts?.coinDecimals ?? 9;
  const poolId = pool.contracts?.marginPoolId;

  React.useEffect(() => {
    async function fetchData() {
      if (!poolId) return;

      try {
        setIsLoading(true);
        setError(null);
        setEvents([]);

        const params = {
          ...timeRangeToParams(timeRange),
          margin_pool_id: poolId,
          limit: 10000,
        };

        const [supplied, withdrawn, borrowed, repaid, liquidations] = await Promise.all([
          fetchAssetSupplied(params),
          fetchAssetWithdrawn(params),
          fetchLoanBorrowed(params),
          fetchLoanRepaid(params),
          fetchLiquidations(params),
        ]);

        const allEvents: UnifiedEvent[] = [];

        // Process supply events
        supplied.forEach((e) => {
          allEvents.push({
            id: `supply-${e.event_digest}`,
            type: "supply",
            timestamp: e.checkpoint_timestamp_ms,
            amount: parseFloat(e.amount) / 10 ** decimals,
            address: e.supplier,
            txDigest: e.digest,
          });
        });

        // Process withdraw events
        withdrawn.forEach((e) => {
          allEvents.push({
            id: `withdraw-${e.event_digest}`,
            type: "withdraw",
            timestamp: e.checkpoint_timestamp_ms,
            amount: parseFloat(e.amount) / 10 ** decimals,
            address: e.supplier,
            txDigest: e.digest,
          });
        });

        // Process borrow events
        borrowed.forEach((e) => {
          allEvents.push({
            id: `borrow-${e.event_digest}`,
            type: "borrow",
            timestamp: e.checkpoint_timestamp_ms,
            amount: parseFloat(e.loan_amount) / 10 ** decimals,
            address: e.margin_manager_id,
            txDigest: e.digest,
          });
        });

        // Process repay events
        repaid.forEach((e) => {
          allEvents.push({
            id: `repay-${e.event_digest}`,
            type: "repay",
            timestamp: e.checkpoint_timestamp_ms,
            amount: parseFloat(e.repay_amount) / 10 ** decimals,
            address: e.margin_manager_id,
            txDigest: e.digest,
          });
        });

        // Process liquidation events
        liquidations.forEach((e) => {
          allEvents.push({
            id: `liquidation-${e.event_digest}`,
            type: "liquidation",
            timestamp: e.checkpoint_timestamp_ms,
            amount: parseFloat(e.liquidation_amount) / 10 ** decimals,
            address: e.margin_manager_id,
            txDigest: e.digest,
            poolReward: parseFloat(e.pool_reward) / 10 ** decimals,
            poolDefault: parseFloat(e.pool_default) / 10 ** decimals,
            riskRatio: parseFloat(e.risk_ratio) / 1e9,
          });
        });

        // Sort by timestamp descending (most recent first)
        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        setEvents(allEvents);
      } catch (err) {
        console.error("Error fetching unified events:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [timeRange, poolId, decimals, serverUrl]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const counts: Record<EventType, number> = {
      supply: 0,
      withdraw: 0,
      borrow: 0,
      repay: 0,
      liquidation: 0,
    };
    const volumes: Record<EventType, number> = {
      supply: 0,
      withdraw: 0,
      borrow: 0,
      repay: 0,
      liquidation: 0,
    };

    events.forEach((e) => {
      counts[e.type]++;
      volumes[e.type] += e.amount;
    });

    return { counts, volumes, total: events.length };
  }, [events]);

  const filteredEvents = React.useMemo(() => {
    return events.filter((e) => filters.has(e.type)).slice(0, showCount);
  }, [events, filters, showCount]);

  const toggleFilter = (type: EventType) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toFixed(2);
  };

  const formatAddress = (addr: string) => {
    if (addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  const getSuiscanUrl = (txDigest: string) => {
    return `https://suiscan.xyz/mainnet/tx/${txDigest}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            On-Chain Event Feed
          </h2>
          <p className="text-sm text-white/60">
            All pool events in chronological order for {pool.asset}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Event Type Filters */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(EVENT_LABELS) as EventType[]).map((type) => {
          const isActive = filters.has(type);
          const colors = EVENT_COLORS[type];
          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                flex items-center gap-2 border
                ${isActive 
                  ? `${colors.bg} ${colors.text} ${colors.border}` 
                  : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                }
              `}
            >
              <span>{EVENT_ICONS[type]}</span>
              <span>{EVENT_LABELS[type]}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isActive ? "bg-white/10" : "bg-white/5"}`}>
                {stats.counts[type]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-5 gap-3">
        {(Object.keys(EVENT_LABELS) as EventType[]).map((type) => {
          const colors = EVENT_COLORS[type];
          return (
            <div key={type} className={`bg-white/5 rounded-xl p-3 border ${colors.border}`}>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                {EVENT_LABELS[type]}
              </div>
              <div className={`text-lg font-bold ${colors.text}`}>
                {formatNumber(stats.volumes[type])}
              </div>
              <div className="text-[10px] text-white/30">
                {stats.counts[type]} txns
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Feed */}
      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/80">
            Recent Events ({filteredEvents.length} of {events.filter((e) => filters.has(e.type)).length})
          </h3>
          <div className="text-xs text-white/40">
            Click tx hash to view on Suiscan
          </div>
        </div>

        {isLoading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
              <div className="text-white/60">Loading events...</div>
            </div>
          </div>
        ) : error ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-2 flex justify-center">
                <ErrorIcon size={32} />
              </div>
              <div className="text-red-300 font-semibold mb-1">Error loading data</div>
              <div className="text-white/60 text-sm">{error.message}</div>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">📋</div>
              <div className="text-white font-semibold text-lg mb-2">No Events Found</div>
              <div className="text-white/60 text-sm">
                No events match your filters in this time range.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {filteredEvents.map((event) => {
                const colors = EVENT_COLORS[event.type];
                return (
                  <div
                    key={event.id}
                    className="px-4 py-3 hover:bg-white/[0.02] transition-colors flex items-center gap-4"
                  >
                    {/* Event Type Badge */}
                    <div className={`w-20 shrink-0`}>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                        <span>{EVENT_ICONS[event.type]}</span>
                        <span>{EVENT_LABELS[event.type]}</span>
                      </span>
                    </div>

                    {/* Amount */}
                    <div className="w-24 shrink-0 text-right">
                      <div className={`font-mono font-medium ${colors.text}`}>
                        {event.type === "supply" || event.type === "borrow" ? "+" : "-"}
                        {formatNumber(event.amount)}
                      </div>
                      <div className="text-[10px] text-white/30">{pool.asset}</div>
                    </div>

                    {/* Address */}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-white/60 truncate">
                        {formatAddress(event.address)}
                      </div>
                      {event.type === "liquidation" && event.riskRatio !== undefined && (
                        <div className="text-[10px] text-amber-400/60">
                          Risk: {(event.riskRatio * 100).toFixed(1)}%
                          {event.poolDefault && event.poolDefault > 0 && (
                            <span className="text-red-400 ml-2">Bad debt: {formatNumber(event.poolDefault)}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Time */}
                    <div className="w-16 shrink-0 text-right">
                      <div className="text-xs text-white/40">{formatTime(event.timestamp)}</div>
                    </div>

                    {/* Tx Link */}
                    {event.txDigest && (
                      <a
                        href={getSuiscanUrl(event.txDigest)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors text-xs text-cyan-400 font-mono"
                      >
                        {event.txDigest.slice(0, 8)}...
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {showCount < events.filter((e) => filters.has(e.type)).length && (
              <div className="p-4 border-t border-white/10 text-center">
                <button
                  onClick={() => setShowCount((prev) => prev + 50)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 transition-colors"
                >
                  Load More Events
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Insight Box */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Complete Picture</span>
            <p className="mt-1">
              See all on-chain activity in one view. Supply/Withdraw show TVL changes, Borrow/Repay show utilization changes, Liquidations show risk events.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Event Correlation</span>
            <p className="mt-1">
              Watch for patterns: large withdrawals often follow rate changes, liquidations cluster during volatility, borrows spike before market moves.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Transparency</span>
            <p className="mt-1">
              Every event links to Suiscan. Verify any transaction on-chain. No hidden activity—everything is public.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Alert Signals</span>
            <p className="mt-1">
              Sudden activity bursts may signal: whale moves, price action, or protocol changes. Filter by type to focus your analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnifiedEventFeed;
