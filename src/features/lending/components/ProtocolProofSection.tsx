import React from 'react';
import {
  fetchLiquidations,
  type LiquidationEventResponse,
} from '../api/events';
import { type TimeRange, timeRangeToParams } from '../api/types';
import TimeRangeSelector from '../../../components/TimeRangeSelector';
import { useAppNetwork } from '../../../context/AppNetworkContext';
import { BadDebtTimeline } from './BadDebtTimeline';
import { LiquidationInsights } from './LiquidationInsights';

interface LiquidatorStats {
  address: string;
  liquidationCount: number;
  totalVolume: number;
  totalRewardsEarned: number;
  lastLiquidationTime: number;
}

interface ProofMetrics {
  badDebtRate: number;
  medianBonusPct: number;
  avgResponseTime: number;
  successRate: number;
}

/**
 * Format address for display
 */
function formatAddress(address: string): string {
  if (!address || address.length < 16) return address || 'Unknown';
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

/**
 * Get rank display with medal
 */
function getRankDisplay(rank: number): React.ReactNode {
  switch (rank) {
    case 1:
      return <span className="text-lg">🥇</span>;
    case 2:
      return <span className="text-lg">🥈</span>;
    case 3:
      return <span className="text-lg">🥉</span>;
    default:
      return <span className="text-sm text-white/40">#{rank}</span>;
  }
}

/**
 * Format number with units
 */
function formatVolume(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
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
 * Format a small on-chain value for display in the table.
 * Shows "<0.01" for tiny non-zero amounts instead of rounding to 0.
 */
function formatSmallValue(raw: string): string {
  const val = parseFloat(raw) / 1e9;
  if (val === 0) return '0';
  if (val > 0 && val < 0.01) return '<0.01';
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Get human-readable time range label
 */
function getTimeRangeLabel(range: TimeRange): string {
  switch (range) {
    case '1W':
      return 'the last week';
    case '1M':
      return 'the last month';
    case '3M':
      return 'the last 3 months';
    case 'YTD':
      return 'year to date';
    case 'ALL':
      return 'all time';
    default:
      return 'this period';
  }
}

/**
 * Calculate proof metrics from liquidation data
 */
function calculateProofMetrics(liquidations: LiquidationEventResponse[], totalVolume: number): ProofMetrics {
  const totalBadDebt = liquidations.reduce(
    (sum, liq) => sum + parseFloat(liq.pool_default) / 1e9,
    0
  );

  // Bad debt rate as percentage of volume
  const badDebtRate = totalVolume > 0 ? (totalBadDebt / totalVolume) * 100 : 0;

  // Calculate bonus percentages
  const bonuses = liquidations
    .filter((liq) => parseFloat(liq.liquidation_amount) > 0)
    .map((liq) => {
      const amount = parseFloat(liq.liquidation_amount) / 1e9;
      const reward = parseFloat(liq.pool_reward) / 1e9;
      return amount > 0 ? (reward / amount) * 100 : 0;
    })
    .filter((b) => b > 0 && b < 100);

  const medianBonusPct =
    bonuses.length > 0
      ? bonuses.sort((a, b) => a - b)[Math.floor(bonuses.length / 2)]
      : 0;

  // Success rate (liquidations without bad debt)
  const successfulLiqs = liquidations.filter(
    (liq) => parseFloat(liq.pool_default) === 0
  ).length;
  const successRate =
    liquidations.length > 0 ? (successfulLiqs / liquidations.length) * 100 : 100;

  return {
    badDebtRate,
    medianBonusPct,
    avgResponseTime: 0, // Would need breach time to calculate
    successRate,
  };
}

/**
 * Protocol Narrative Block - Plain-language summary
 */
function ProtocolNarrativeBlock({
  totalLiquidations,
  totalBadDebt,
  totalVolume,
  totalRewards,
  timeRange,
}: {
  totalLiquidations: number;
  totalBadDebt: number;
  totalVolume: number;
  totalRewards: number;
  timeRange: TimeRange;
}) {
  const periodLabel = getTimeRangeLabel(timeRange);

  const getNarrative = () => {
    if (totalLiquidations === 0) {
      return {
        headline: 'No liquidations recorded',
        explanation: `Over ${periodLabel}, there have been no liquidation events. This indicates either low borrowing activity or very conservative position management.`,
        sentiment: 'neutral' as const,
      };
    }

    if (totalBadDebt === 0) {
      return {
        headline: 'Liquidations are healthy and profitable',
        explanation: `Over ${periodLabel}, ${totalLiquidations.toLocaleString()} liquidations were processed with zero bad debt. Liquidators earned ${formatVolume(totalRewards)} in rewards.`,
        sentiment: 'positive' as const,
      };
    }

    const badDebtRatio = totalVolume > 0 ? (totalBadDebt / totalVolume) * 100 : 0;

    if (badDebtRatio < 5) {
      return {
        headline: 'Protocol health is strong',
        explanation: `Over ${periodLabel}, the protocol absorbed ${formatVolume(totalBadDebt)} in bad debt while processing ${totalLiquidations.toLocaleString()} liquidations. Bad debt represents only ${badDebtRatio.toFixed(1)}% of liquidation volume.`,
        sentiment: 'cautious' as const,
      };
    }

    return {
      headline: 'Protocol has absorbed bad debt',
      explanation: `Over ${periodLabel}, ${formatVolume(totalBadDebt)} in bad debt occurred when collateral was insufficient. This represents ${badDebtRatio.toFixed(1)}% of liquidation volume.`,
      sentiment: 'warning' as const,
    };
  };

  const narrative = getNarrative();

  const sentimentStyles = {
    positive: 'bg-emerald-500/10 border-emerald-500/20',
    neutral: 'bg-white/[0.03] border-white/[0.06]',
    cautious: 'bg-amber-500/10 border-amber-500/20',
    warning: 'bg-rose-500/10 border-rose-500/20',
  };

  const iconColors = {
    positive: 'text-emerald-400',
    neutral: 'text-white/50',
    cautious: 'text-amber-400',
    warning: 'text-rose-400',
  };

  return (
    <div className={`rounded-xl border p-4 ${sentimentStyles[narrative.sentiment]}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${iconColors[narrative.sentiment]}`}>
          {narrative.sentiment === 'positive' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">{narrative.headline}</h4>
          <p className="text-sm text-white/60 mt-0.5 leading-relaxed">
            {narrative.explanation}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Protocol Proof Section - Historical stats, leaderboard, bad debt tracking
 */
const EVENTS_PER_PAGE = 20;

export function ProtocolProofSection() {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>('3M');
  const [liquidations, setLiquidations] = React.useState<LiquidationEventResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [activeView, setActiveView] = React.useState<'history' | 'leaderboard'>('leaderboard');
  const [eventsPage, setEventsPage] = React.useState<number>(1);

  // Fetch liquidation data
  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        setLiquidations([]);
        const params = timeRangeToParams(timeRange);
        const data = await fetchLiquidations({ ...params, limit: 10000 });
        setLiquidations(data);
      } catch (err) {
        console.error('Error fetching liquidations:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [timeRange, serverUrl]);

  // Calculate lifetime metrics
  const lifetimeMetrics = React.useMemo(() => {
    const totalLiquidations = liquidations.length;
    const totalVolume = liquidations.reduce(
      (sum, liq) => sum + parseFloat(liq.liquidation_amount) / 1e9,
      0
    );
    const totalRewards = liquidations.reduce(
      (sum, liq) => sum + parseFloat(liq.pool_reward) / 1e9,
      0
    );
    const totalBadDebt = liquidations.reduce(
      (sum, liq) => sum + parseFloat(liq.pool_default) / 1e9,
      0
    );

    return { totalLiquidations, totalVolume, totalRewards, totalBadDebt };
  }, [liquidations]);

  // Calculate proof metrics
  const proofMetrics = React.useMemo(
    () => calculateProofMetrics(liquidations, lifetimeMetrics.totalVolume),
    [liquidations, lifetimeMetrics.totalVolume]
  );

  // Sorted liquidations for table
  const sortedLiquidations = React.useMemo(() => {
    return [...liquidations].sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms);
  }, [liquidations]);

  // Pagination for events table
  const eventsTotalPages = Math.ceil(sortedLiquidations.length / EVENTS_PER_PAGE);
  const paginatedLiquidations = React.useMemo(() => {
    const startIndex = (eventsPage - 1) * EVENTS_PER_PAGE;
    return sortedLiquidations.slice(startIndex, startIndex + EVENTS_PER_PAGE);
  }, [sortedLiquidations, eventsPage]);

  // Reset events page when time range changes
  React.useEffect(() => {
    setEventsPage(1);
  }, [timeRange]);

  // Aggregate by liquidator for leaderboard
  const leaderboard = React.useMemo((): LiquidatorStats[] => {
    const map = new Map<
      string,
      { count: number; volume: number; rewards: number; lastTime: number }
    >();

    liquidations.forEach((liq) => {
      const addr = liq.sender;
      if (!addr) return;

      const existing = map.get(addr) || { count: 0, volume: 0, rewards: 0, lastTime: 0 };
      existing.count += 1;
      existing.volume += parseFloat(liq.liquidation_amount) / 1e9;
      existing.rewards += parseFloat(liq.pool_reward) / 1e9;
      existing.lastTime = Math.max(existing.lastTime, liq.checkpoint_timestamp_ms);
      map.set(addr, existing);
    });

    return Array.from(map.entries())
      .map(([address, stats]) => ({
        address,
        liquidationCount: stats.count,
        totalVolume: stats.volume,
        totalRewardsEarned: stats.rewards,
        lastLiquidationTime: stats.lastTime,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [liquidations]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* ═══════════════════════════════════════════════════════════════════
          PROTOCOL METRICS HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-white/[0.04] to-white/[0.01] rounded-xl border border-white/[0.06] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Protocol Health Metrics
          </h3>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        {/* Narrative Block */}
        {!isLoading && (
          <ProtocolNarrativeBlock
            totalLiquidations={lifetimeMetrics.totalLiquidations}
            totalBadDebt={lifetimeMetrics.totalBadDebt}
            totalVolume={lifetimeMetrics.totalVolume}
            totalRewards={lifetimeMetrics.totalRewards}
            timeRange={timeRange}
          />
        )}

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <div className="text-center">
            <div className="text-3xl font-bold text-white tabular-nums">
              {isLoading ? (
                <div className="h-9 w-16 mx-auto bg-white/10 rounded animate-pulse" />
              ) : (
                lifetimeMetrics.totalLiquidations.toLocaleString()
              )}
            </div>
            <div className="text-xs text-white/50 mt-1">Total Liquidations</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-teal-400 tabular-nums">
              {isLoading ? (
                <div className="h-9 w-16 mx-auto bg-white/10 rounded animate-pulse" />
              ) : (
                formatVolume(lifetimeMetrics.totalVolume)
              )}
            </div>
            <div className="text-xs text-white/50 mt-1">Volume Processed</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400 tabular-nums">
              {isLoading ? (
                <div className="h-9 w-16 mx-auto bg-white/10 rounded animate-pulse" />
              ) : (
                formatVolume(lifetimeMetrics.totalRewards)
              )}
            </div>
            <div className="text-xs text-white/50 mt-1">Rewards Paid</div>
          </div>

          <div className="text-center">
            <div
              className={`text-3xl font-bold tabular-nums ${
                lifetimeMetrics.totalBadDebt > 0 ? 'text-rose-400' : 'text-white/30'
              }`}
            >
              {isLoading ? (
                <div className="h-9 w-16 mx-auto bg-white/10 rounded animate-pulse" />
              ) : lifetimeMetrics.totalBadDebt > 0 ? (
                formatVolume(lifetimeMetrics.totalBadDebt)
              ) : (
                '0'
              )}
            </div>
            <div className="text-xs text-white/50 mt-1">Bad Debt</div>
          </div>
        </div>

        {/* Proof Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {/* Bad Debt Rate */}
          <div className="bg-white/[0.04] rounded-lg p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  proofMetrics.badDebtRate === 0
                    ? 'bg-emerald-500/20'
                    : proofMetrics.badDebtRate < 5
                    ? 'bg-amber-500/20'
                    : 'bg-rose-500/20'
                }`}
              >
                <svg
                  className={`w-4 h-4 ${
                    proofMetrics.badDebtRate === 0
                      ? 'text-emerald-400'
                      : proofMetrics.badDebtRate < 5
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                Bad Debt Rate
              </span>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-white/10 rounded animate-pulse" />
            ) : (
              <div
                className={`text-2xl font-bold tabular-nums ${
                  proofMetrics.badDebtRate === 0
                    ? 'text-emerald-400'
                    : proofMetrics.badDebtRate < 5
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {proofMetrics.badDebtRate.toFixed(2)}%
              </div>
            )}
          </div>

          {/* Median Bonus */}
          <div className="bg-white/[0.04] rounded-lg p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                  />
                </svg>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                Median Bonus
              </span>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-white/10 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold text-teal-400 tabular-nums">
                {proofMetrics.medianBonusPct.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Success Rate */}
          <div className="bg-white/[0.04] rounded-lg p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                Success Rate
              </span>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-white/10 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                {proofMetrics.successRate.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BAD DEBT TIMELINE
      ═══════════════════════════════════════════════════════════════════ */}
      <BadDebtTimeline liquidations={liquidations} isLoading={isLoading} />

      {/* ═══════════════════════════════════════════════════════════════════
          LIQUIDATION INSIGHTS - Pool breakdown, distributions, heatmap
      ═══════════════════════════════════════════════════════════════════ */}
      <LiquidationInsights liquidations={liquidations} isLoading={isLoading} />

      {/* ═══════════════════════════════════════════════════════════════════
          VIEW TOGGLE - History vs Leaderboard
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveView('leaderboard')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeView === 'leaderboard'
              ? 'bg-amber-500 text-slate-900'
              : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/15'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Top Liquidators
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeView === 'history'
              ? 'bg-teal-500 text-slate-900'
              : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/15'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Recent Events
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT AREA
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-white/50 text-sm">Loading data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="text-rose-400 mb-2">Error loading data</div>
            <p className="text-white/50 text-sm">{error.message}</p>
          </div>
        ) : activeView === 'leaderboard' ? (
          /* Leaderboard */
          leaderboard.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <p className="text-base font-medium text-white">No Liquidators Yet</p>
              <p className="text-sm text-white/40 mt-1">
                No one has performed liquidations in this period
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {leaderboard.slice(0, 10).map((liquidator, idx) => {
                const rank = idx + 1;
                const isTopThree = rank <= 3;
                const volumePercent =
                  lifetimeMetrics.totalVolume > 0
                    ? (liquidator.totalVolume / lifetimeMetrics.totalVolume) * 100
                    : 0;

                return (
                  <div
                    key={liquidator.address}
                    className={`flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors ${
                      isTopThree ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-10 text-center">{getRankDisplay(rank)}</div>

                    {/* Address + Volume bar */}
                    <div className="flex-1 min-w-0">
                      <a
                        href={`https://suivision.xyz/account/${liquidator.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 text-sm font-mono flex items-center gap-1"
                      >
                        {formatAddress(liquidator.address)}
                        <svg
                          className="w-3 h-3 opacity-50"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                      {isTopThree && (
                        <div className="w-full h-1.5 mt-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                            style={{ width: `${Math.max(volumePercent, 5)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="font-bold text-white tabular-nums">
                          {liquidator.liquidationCount}
                        </div>
                        <div className="text-[10px] text-white/40">liquidations</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-teal-400 tabular-nums">
                          {formatVolume(liquidator.totalVolume)}
                        </div>
                        <div className="text-[10px] text-white/40">volume</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400 tabular-nums">
                          {liquidator.totalRewardsEarned.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-[10px] text-white/40">earned</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {leaderboard.length > 10 && (
                <div className="text-center py-3 text-white/30 text-xs">
                  + {leaderboard.length - 10} more liquidators
                </div>
              )}
            </div>
          )
        ) : (
          /* Recent Events Table */
          liquidations.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-base font-medium text-white">No Liquidations Yet</p>
              <p className="text-sm text-white/40 mt-1">No events recorded in this time period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider bg-white/[0.02]">
                    <th className="text-left py-3 px-4 text-white/40 font-medium">Time</th>
                    <th className="text-left py-3 px-4 text-white/40 font-medium">Liquidator</th>
                    <th className="text-left py-3 px-4 text-white/40 font-medium">Position</th>
                    <th className="text-right py-3 px-4 text-white/40 font-medium">Amount</th>
                    <th className="text-right py-3 px-4 text-white/40 font-medium">Reward</th>
                    <th className="text-right py-3 px-4 text-white/40 font-medium">Bad Debt</th>
                    <th className="text-center py-3 px-4 text-white/40 font-medium">Explorer</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLiquidations.map((liq, index) => {
                      const hasBadDebt = parseFloat(liq.pool_default) > 0;
                      return (
                        <tr
                          key={index}
                          className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${
                            hasBadDebt ? 'bg-rose-500/5' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-white/70 text-xs">
                            {new Date(liq.checkpoint_timestamp_ms).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <a
                              href={`https://suivision.xyz/account/${liq.sender}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 text-xs font-mono flex items-center gap-1"
                            >
                              {formatAddress(liq.sender)}
                              <svg
                                className="w-2.5 h-2.5 opacity-50"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          </td>
                          <td className="py-3 px-4">
                            <a
                              href={`https://suivision.xyz/object/${liq.margin_manager_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 text-xs font-mono flex items-center gap-1"
                            >
                              {formatAddress(liq.margin_manager_id)}
                              <svg
                                className="w-2.5 h-2.5 opacity-50"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          </td>
                          <td className="py-3 px-4 text-right text-white font-medium tabular-nums">
                            {formatSmallValue(liq.liquidation_amount)}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-400 tabular-nums">
                            {formatSmallValue(liq.pool_reward)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right tabular-nums ${
                              hasBadDebt ? 'text-rose-400 font-medium' : 'text-white/30'
                            }`}
                          >
                            {formatSmallValue(liq.pool_default)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <a
                              href={`https://suivision.xyz/txblock/${liq.tx_digest || liq.margin_manager_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
                            >
                              View
                              <svg
                                className="w-2.5 h-2.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {eventsTotalPages > 1 && (
                <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
                  <div className="text-xs text-white/40">
                    Showing {((eventsPage - 1) * EVENTS_PER_PAGE) + 1}–{Math.min(eventsPage * EVENTS_PER_PAGE, sortedLiquidations.length)} of {sortedLiquidations.length} liquidations
                  </div>
                  <div className="flex items-center gap-1">
                    {/* First Page */}
                    <button
                      onClick={() => setEventsPage(1)}
                      disabled={eventsPage === 1}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="First page"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    {/* Previous Page */}
                    <button
                      onClick={() => setEventsPage(p => Math.max(1, p - 1))}
                      disabled={eventsPage === 1}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Previous page"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-0.5 mx-1">
                      {(() => {
                        const pages: (number | 'ellipsis')[] = [];
                        const maxVisible = 5;
                        
                        if (eventsTotalPages <= maxVisible) {
                          for (let i = 1; i <= eventsTotalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          
                          if (eventsPage > 3) {
                            pages.push('ellipsis');
                          }
                          
                          const start = Math.max(2, eventsPage - 1);
                          const end = Math.min(eventsTotalPages - 1, eventsPage + 1);
                          
                          for (let i = start; i <= end; i++) {
                            if (!pages.includes(i)) pages.push(i);
                          }
                          
                          if (eventsPage < eventsTotalPages - 2) {
                            pages.push('ellipsis');
                          }
                          
                          if (!pages.includes(eventsTotalPages)) pages.push(eventsTotalPages);
                        }
                        
                        return pages.map((page, idx) => 
                          page === 'ellipsis' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-white/30">…</span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => setEventsPage(page)}
                              className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-colors ${
                                eventsPage === page
                                  ? 'bg-teal-500 text-slate-900'
                                  : 'text-white/60 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              {page}
                            </button>
                          )
                        );
                      })()}
                    </div>

                    {/* Next Page */}
                    <button
                      onClick={() => setEventsPage(p => Math.min(eventsTotalPages, p + 1))}
                      disabled={eventsPage === eventsTotalPages}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Next page"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Last Page */}
                    <button
                      onClick={() => setEventsPage(eventsTotalPages)}
                      disabled={eventsPage === eventsTotalPages}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Last page"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Footer Note */}
      <p className="text-[10px] text-white/30 text-center">
        Data from on-chain liquidation events · All links verified on SuiVision ·{' '}
        {getTimeRangeLabel(timeRange)}
      </p>
    </div>
  );
}
