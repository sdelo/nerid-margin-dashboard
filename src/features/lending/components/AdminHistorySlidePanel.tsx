import type { FC } from "react";
import { useAdminHistory, type AdminEvent } from "../hooks/useAdminHistory";
import { useAppNetwork } from "../../../context/AppNetworkContext";

interface Props {
  poolId?: string;
  poolName?: string;
}

/**
 * Format 9-decimal values to percentage (e.g., 900000000 => 90%)
 */
function nineDecimalToPercent(value: string | bigint): string {
  const num = Number(value) / 1_000_000_000;
  return `${(num * 100).toFixed(2)}%`;
}

/**
 * Format large numbers with commas
 */
function formatNumber(n: string | number | bigint): string {
  return Intl.NumberFormat('en-US').format(Number(n));
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time (e.g., "2 days ago")
 */
function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

/**
 * Render event details based on type
 */
function EventDetails({ event }: { event: AdminEvent }) {
  switch (event.type) {
    case 'interest_params': {
      // Access data directly from event.data (it's flattened, not nested under 'parsed')
      const config = event.data.interest_config;
      if (!config) {
        return <div className="text-red-400 text-sm">Invalid event data structure</div>;
      }
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-white/40">Base Rate:</div>
            <div className="text-white font-mono">{nineDecimalToPercent(config.base_rate)}</div>
            
            <div className="text-white/40">Base Slope:</div>
            <div className="text-white font-mono">{nineDecimalToPercent(config.base_slope)}</div>
            
            <div className="text-white/40">Optimal Utilization:</div>
            <div className="text-white font-mono">{nineDecimalToPercent(config.optimal_utilization)}</div>
            
            <div className="text-white/40">Excess Slope:</div>
            <div className="text-white font-mono">{nineDecimalToPercent(config.excess_slope)}</div>
          </div>
          <div className="text-xs text-white/30 pt-2 border-t border-white/5">
            Pool Cap ID: <span className="font-mono">{event.data.pool_cap_id?.slice(0, 8) || 'N/A'}...</span>
          </div>
        </div>
      );
    }

    case 'pool_config': {
      // Access data directly from event.data
      const config = event.data.margin_pool_config;
      if (!config) {
        return <div className="text-red-400 text-sm">Invalid event data structure</div>;
      }
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-white/40">Supply Cap:</div>
            <div className="text-white font-mono">{formatNumber(config.supply_cap)}</div>
            
            <div className="text-white/40">Max Utilization:</div>
            <div className="text-white font-mono">{nineDecimalToPercent(config.max_utilization_rate)}</div>
            
            <div className="text-white/40">Protocol Spread:</div>
            <div className="text-white font-mono">{nineDecimalToPercent(config.protocol_spread)}</div>
            
            <div className="text-white/40">Min Borrow:</div>
            <div className="text-white font-mono">{formatNumber(config.min_borrow)}</div>
          </div>
          <div className="text-xs text-white/30 pt-2 border-t border-white/5">
            Pool Cap ID: <span className="font-mono">{event.data.pool_cap_id?.slice(0, 8) || 'N/A'}...</span>
          </div>
        </div>
      );
    }

    case 'deepbook_pool': {
      // Access data directly from event.data
      const data = event.data;
      if (!data || !data.deepbook_pool_id) {
        return <div className="text-red-400 text-sm">Invalid event data structure</div>;
      }
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-white/40">DeepBook Pool:</div>
            <div className="text-white font-mono text-xs break-all">
              {data.deepbook_pool_id.slice(0, 16)}...
            </div>
            
            <div className="text-white/40">Status:</div>
            <div className={`font-semibold ${data.enabled ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <div className="text-xs text-white/30 pt-2 border-t border-white/5">
            Pool Cap ID: <span className="font-mono">{data.pool_cap_id?.slice(0, 8) || 'N/A'}...</span>
          </div>
        </div>
      );
    }

    case 'pool_created': {
      // Access data directly from event.data
      const data = event.data;
      if (!data) {
        return <div className="text-red-400 text-sm">Invalid event data structure</div>;
      }
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-white/40">Asset Type:</div>
            <div className="text-white font-mono text-xs break-all">{data.asset_type || 'N/A'}</div>
            
            <div className="text-white/40">Maintainer Cap:</div>
            <div className="text-white font-mono text-xs">
              {data.maintainer_cap_id?.slice(0, 16) || 'N/A'}...
            </div>
          </div>
          <div className="text-xs text-white/30 pt-2 border-t border-white/5">
            Initial pool creation event
          </div>
        </div>
      );
    }
  }
}

/**
 * Get event type display info
 */
function getEventTypeInfo(type: AdminEvent['type']): { label: string; color: string; bgColor: string } {
  switch (type) {
    case 'interest_params':
      return { label: 'Interest Rate Update', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' };
    case 'pool_config':
      return { label: 'Pool Config Update', color: 'text-teal-400', bgColor: 'bg-amber-500/20' };
    case 'deepbook_pool':
      return { label: 'DeepBook Pool Update', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' };
    case 'pool_created':
      return { label: 'Pool Created', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' };
  }
}

export const AdminHistorySlidePanel: FC<Props> = ({ poolId, poolName = 'Pool' }) => {
  const { events, isLoading, error } = useAdminHistory(poolId);
  const { explorerUrl } = useAppNetwork();

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/70 text-sm">Loading admin history...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
            <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
            <div className="h-3 bg-white/10 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-red-400 text-lg mb-2">Error Loading History</div>
          <div className="text-red-200/60 text-sm">
            {error instanceof Error ? error.message : 'Failed to fetch admin events'}
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="text-white text-lg mb-2">No Admin Changes Yet</div>
          <div className="text-white/50 text-sm">
            This pool has no recorded administrative configuration changes.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-white mb-1">Admin Configuration History</h3>
            <p className="text-white/50 text-sm">
              {poolName} • {events.length} change{events.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {events.map((event, index) => {
          const typeInfo = getEventTypeInfo(event.type);
          const isFirst = index === 0;

          return (
            <div
              key={`${event.type}-${event.data.checkpoint_timestamp_ms}-${index}`}
              className={`
                relative bg-white/5 border rounded-xl p-4 transition-all duration-200
                hover:bg-white/10
                ${isFirst ? 'border-teal-400/30' : 'border-white/10'}
              `}
            >
              {/* Timeline dot */}
              <div className="absolute -left-1.5 top-6 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-900 hidden md:block" />
              
              {/* Event Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full ${typeInfo.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <svg className={`w-5 h-5 ${typeInfo.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {event.type === 'interest_params' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      )}
                      {event.type === 'pool_config' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      )}
                      {event.type === 'deepbook_pool' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      )}
                      {event.type === 'pool_created' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <div className={`font-semibold ${typeInfo.color}`}>{typeInfo.label}</div>
                    <div className="text-xs text-white/50">
                      {formatDate(event.data.checkpoint_timestamp_ms)} • {getRelativeTime(event.data.checkpoint_timestamp_ms)}
                    </div>
                  </div>
                </div>
                {isFirst && (
                  <span className="text-xs font-semibold text-teal-400 bg-teal-400/10 px-2 py-1 rounded flex-shrink-0">
                    Latest
                  </span>
                )}
              </div>

              {/* Event Details */}
              <div className="ml-0 md:ml-12 bg-white/5 rounded-lg p-3 border border-white/5">
                <EventDetails event={event} />
              </div>

              {/* Transaction Link */}
              <div className="ml-0 md:ml-12 mt-2">
                <a
                  href={`${explorerUrl}/txblock/${event.data.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <span>View Transaction</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-white/30 pt-4 border-t border-white/5">
        All times shown in your local timezone • Events from last 12 months
      </div>
    </div>
  );
};

export default AdminHistorySlidePanel;
