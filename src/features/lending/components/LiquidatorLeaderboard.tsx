import React from 'react';
import {
  fetchLiquidations,
  type LiquidationEventResponse,
} from '../api/events';
import { type TimeRange, timeRangeToParams } from '../api/types';
import TimeRangeSelector from '../../../components/TimeRangeSelector';
import { useAppNetwork } from '../../../context/AppNetworkContext';
import { TridentIcon, HealthyAnchorIcon, ErrorIcon } from '../../../components/ThemedIcons';

interface LiquidatorStats {
  address: string;
  liquidationCount: number;
  totalVolumeRaw: number;        // In smallest units
  totalVolume: number;           // Normalized (divided by 1e9)
  totalRewardsEarned: number;    // Pool rewards (approximation)
  averageLiquidationSize: number;
  lastLiquidationTime: number;
  rank: number;
}

interface LiquidatorLeaderboardProps {
  className?: string;
}

type RankingMetric = 'volume' | 'count' | 'rewards' | 'avgSize';

/**
 * Format address for display
 */
function formatAddress(address: string): string {
  if (!address || address.length < 16) return address || 'Unknown';
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

/**
 * Get medal emoji for rank
 */
function getRankDisplay(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `#${rank}`;
  }
}

/**
 * Liquidator Leaderboard Component
 */
export function LiquidatorLeaderboard({ className = '' }: LiquidatorLeaderboardProps) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>('1M');
  const [rankingMetric, setRankingMetric] = React.useState<RankingMetric>('volume');
  const [liquidators, setLiquidators] = React.useState<LiquidatorStats[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Fetch and aggregate liquidation data
  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        // Clear old data immediately when server changes
        setLiquidators([]);
        
        const params = timeRangeToParams(timeRange);
        const liquidations = await fetchLiquidations({ ...params, limit: 10000 });

        // Aggregate by liquidator (sender)
        const liquidatorMap = new Map<string, {
          count: number;
          totalVolume: number;
          totalRewards: number;
          lastTime: number;
        }>();

        liquidations.forEach((liq: LiquidationEventResponse) => {
          const liquidator = liq.sender;
          if (!liquidator) return;

          const existing = liquidatorMap.get(liquidator) || {
            count: 0,
            totalVolume: 0,
            totalRewards: 0,
            lastTime: 0,
          };

          existing.count += 1;
          existing.totalVolume += parseFloat(liq.liquidation_amount);
          existing.totalRewards += parseFloat(liq.pool_reward);
          existing.lastTime = Math.max(existing.lastTime, liq.checkpoint_timestamp_ms);

          liquidatorMap.set(liquidator, existing);
        });

        // Convert to array (sorting happens in useMemo based on rankingMetric)
        const unsorted: LiquidatorStats[] = Array.from(liquidatorMap.entries())
          .map(([address, stats]) => ({
            address,
            liquidationCount: stats.count,
            totalVolumeRaw: stats.totalVolume,
            totalVolume: stats.totalVolume / 1e9,
            totalRewardsEarned: stats.totalRewards / 1e9,
            averageLiquidationSize: (stats.totalVolume / 1e9) / stats.count,
            lastLiquidationTime: stats.lastTime,
            rank: 0, // Will be set after sorting
          }));

        setLiquidators(unsorted);
      } catch (err) {
        console.error('Error fetching liquidator data:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [timeRange, serverUrl]);

  // Sort liquidators based on ranking metric
  const sortedLiquidators = React.useMemo(() => {
    const sorted = [...liquidators].sort((a, b) => {
      switch (rankingMetric) {
        case 'volume':
          return b.totalVolume - a.totalVolume;
        case 'count':
          return b.liquidationCount - a.liquidationCount;
        case 'rewards':
          return b.totalRewardsEarned - a.totalRewardsEarned;
        case 'avgSize':
          return b.averageLiquidationSize - a.averageLiquidationSize;
        default:
          return b.totalVolume - a.totalVolume;
      }
    });
    return sorted.map((item, index) => ({ ...item, rank: index + 1 }));
  }, [liquidators, rankingMetric]);

  // Calculate totals
  const totalVolume = liquidators.reduce((sum, l) => sum + l.totalVolume, 0);
  const totalLiquidations = liquidators.reduce((sum, l) => sum + l.liquidationCount, 0);
  const uniqueLiquidators = liquidators.length;
  const totalRewards = liquidators.reduce((sum, l) => sum + l.totalRewardsEarned, 0);

  return (
    <div className={`bg-white/5 rounded-2xl p-6 border border-white/10 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TridentIcon size={22} />
            Liquidator Leaderboard
          </h3>
          <p className="text-sm text-white/60 mt-1">
            Top liquidators ranked by {rankingMetric === 'volume' ? 'volume' : rankingMetric === 'count' ? 'liquidation count' : rankingMetric === 'rewards' ? 'rewards earned' : 'average size'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Ranking Metric Toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
            {[
              { key: 'volume', label: 'Volume' },
              { key: 'count', label: 'Count' },
              { key: 'rewards', label: 'Rewards' },
              { key: 'avgSize', label: 'Avg Size' },
            ].map((metric) => (
              <button
                key={metric.key}
                onClick={() => setRankingMetric(metric.key as RankingMetric)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  rankingMetric === metric.key
                    ? 'bg-teal-400 text-slate-900'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-2xl font-bold text-teal-400 tabular-nums">
            {uniqueLiquidators}
          </div>
          <div className="text-xs text-white/60">Active Liquidators</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-2xl font-bold text-cyan-400 tabular-nums">
            {totalLiquidations.toLocaleString()}
          </div>
          <div className="text-xs text-white/60">Total Liquidations</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-2xl font-bold text-cyan-400 tabular-nums">
            {totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-white/60">Total Volume</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">
            {totalRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-white/60">Total Rewards</div>
        </div>
      </div>

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
            <span className="text-white/60">Loading leaderboard...</span>
          </div>
        </div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-2 flex justify-center">
              <ErrorIcon size={32} />
            </div>
            <div className="text-rose-400">Error loading data</div>
            <div className="text-white/60 text-sm mt-1">{error.message}</div>
          </div>
        </div>
      ) : liquidators.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <HealthyAnchorIcon size={48} />
            </div>
            <div className="text-white font-semibold">No Liquidations Yet</div>
            <div className="text-white/60 text-sm mt-1">
              No liquidations recorded in this time period
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-white/60 font-semibold w-16">Rank</th>
                <th className="text-left py-2 px-3 text-white/60 font-semibold">Liquidator</th>
                <th className={`text-right py-2 px-3 font-semibold cursor-pointer hover:text-white transition-colors ${rankingMetric === 'count' ? 'text-teal-400' : 'text-white/60'}`} onClick={() => setRankingMetric('count')}>
                  Liquidations {rankingMetric === 'count' && '↓'}
                </th>
                <th className={`text-right py-2 px-3 font-semibold cursor-pointer hover:text-white transition-colors ${rankingMetric === 'volume' ? 'text-teal-400' : 'text-white/60'}`} onClick={() => setRankingMetric('volume')}>
                  Volume {rankingMetric === 'volume' && '↓'}
                </th>
                <th className={`text-right py-2 px-3 font-semibold cursor-pointer hover:text-white transition-colors ${rankingMetric === 'rewards' ? 'text-teal-400' : 'text-white/60'}`} onClick={() => setRankingMetric('rewards')}>
                  Rewards {rankingMetric === 'rewards' && '↓'}
                </th>
                <th className={`text-right py-2 px-3 font-semibold cursor-pointer hover:text-white transition-colors ${rankingMetric === 'avgSize' ? 'text-teal-400' : 'text-white/60'}`} onClick={() => setRankingMetric('avgSize')}>
                  Avg Size {rankingMetric === 'avgSize' && '↓'}
                </th>
                <th className="text-right py-2 px-3 text-white/60 font-semibold">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {sortedLiquidators.slice(0, 10).map((liquidator) => {
                const isTopThree = liquidator.rank <= 3;
                const volumePercent = totalVolume > 0 ? (liquidator.totalVolume / totalVolume) * 100 : 0;
                
                return (
                  <tr
                    key={liquidator.address}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      isTopThree ? 'bg-teal-500/5' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <span className={`text-lg ${isTopThree ? '' : 'text-white/60'}`}>
                        {getRankDisplay(liquidator.rank)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <a
                        href={`https://suivision.xyz/account/${liquidator.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-cyan-300 hover:text-cyan-200 transition-colors text-xs"
                      >
                        {formatAddress(liquidator.address)}
                      </a>
                      {isTopThree && (
                        <div className="w-full h-1 mt-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full"
                            style={{ width: `${Math.max(volumePercent, 5)}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${rankingMetric === 'count' ? 'text-teal-400 font-bold' : 'text-white font-semibold'}`}>
                      {liquidator.liquidationCount.toLocaleString()}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${rankingMetric === 'volume' ? 'text-teal-400 font-bold' : 'text-white'}`}>
                      {liquidator.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="text-white/40 text-xs ml-1">
                        ({volumePercent.toFixed(1)}%)
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${rankingMetric === 'rewards' ? 'text-emerald-400 font-bold' : 'text-emerald-400/80'}`}>
                      {liquidator.totalRewardsEarned.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${rankingMetric === 'avgSize' ? 'text-teal-400 font-bold' : 'text-white/80'}`}>
                      {liquidator.averageLiquidationSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-3 text-right text-white/60 text-xs">
                      {new Date(liquidator.lastLiquidationTime).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {sortedLiquidators.length > 10 && (
            <div className="text-center py-3 text-white/40 text-sm">
              + {sortedLiquidators.length - 10} more liquidators
            </div>
          )}
        </div>
      )}

      {/* Note about data */}
      {liquidators.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40">
            Volume shown in native asset units. The <code className="text-cyan-400">sender</code> field
            of liquidation events identifies who executed the liquidation transaction.
          </p>
        </div>
      )}
    </div>
  );
}

