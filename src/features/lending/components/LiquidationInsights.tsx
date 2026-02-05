import React from 'react';
import { type LiquidationEventResponse } from '../api/events';
import { getMarginPools, type NetworkType } from '../../../config/contracts';
import { useSuiClientContext } from '@mysten/dapp-kit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAddress(address: string): string {
  if (!address || address.length < 16) return address || 'Unknown';
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return value.toFixed(1);
  if (value > 0) return value.toFixed(2);
  return '0';
}

function usePoolIdToAsset(): Map<string, string> {
  const { network } = useSuiClientContext();
  return React.useMemo(() => {
    const pools = getMarginPools(network as NetworkType);
    const map = new Map<string, string>();
    pools.forEach((p) => map.set(p.poolId, p.asset));
    return map;
  }, [network]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiquidationInsightsProps {
  liquidations: LiquidationEventResponse[];
  isLoading: boolean;
}

interface PoolStats {
  asset: string;
  poolId: string;
  count: number;
  volume: number;
  rewards: number;
  badDebt: number;
  avgSize: number;
  avgRiskRatio: number;
}

// ─── 1. Pool Breakdown Cards ──────────────────────────────────────────────────

function PoolBreakdownSection({
  liquidations,
  poolIdToAsset,
}: {
  liquidations: LiquidationEventResponse[];
  poolIdToAsset: Map<string, string>;
}) {
  const poolStats = React.useMemo((): PoolStats[] => {
    const map = new Map<
      string,
      { count: number; volume: number; rewards: number; badDebt: number; riskSum: number }
    >();

    liquidations.forEach((liq) => {
      const poolId = liq.margin_pool_id;
      const existing = map.get(poolId) || { count: 0, volume: 0, rewards: 0, badDebt: 0, riskSum: 0 };
      existing.count += 1;
      existing.volume += parseFloat(liq.liquidation_amount) / 1e9;
      existing.rewards += parseFloat(liq.pool_reward) / 1e9;
      existing.badDebt += parseFloat(liq.pool_default) / 1e9;
      existing.riskSum += parseFloat(liq.risk_ratio) / 1e9;
      map.set(poolId, existing);
    });

    return Array.from(map.entries())
      .map(([poolId, stats]) => ({
        asset: poolIdToAsset.get(poolId) || formatAddress(poolId),
        poolId,
        count: stats.count,
        volume: stats.volume,
        rewards: stats.rewards,
        badDebt: stats.badDebt,
        avgSize: stats.count > 0 ? stats.volume / stats.count : 0,
        avgRiskRatio: stats.count > 0 ? stats.riskSum / stats.count : 0,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [liquidations, poolIdToAsset]);

  if (poolStats.length === 0) return null;

  const maxVolume = Math.max(...poolStats.map((p) => p.volume), 1);

  const poolColors: Record<string, { bg: string; border: string; text: string; bar: string }> = {
    SUI: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', bar: 'from-blue-500 to-blue-400' },
    USDC: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'from-emerald-500 to-emerald-400' },
    DEEP: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', bar: 'from-purple-500 to-purple-400' },
    WAL: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', bar: 'from-amber-500 to-amber-400' },
  };
  const defaultColors = { bg: 'bg-white/[0.04]', border: 'border-white/[0.08]', text: 'text-white/70', bar: 'from-teal-500 to-teal-400' };

  return (
    <div className="bg-gradient-to-r from-white/[0.04] to-white/[0.01] rounded-xl border border-white/[0.06] p-6">
      <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
        <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        Liquidations by Pool
      </h3>
      <p className="text-xs text-white/40 mb-4">Which lending pools see the most liquidation activity</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {poolStats.map((pool) => {
          const colors = poolColors[pool.asset] || defaultColors;
          const volumePct = (pool.volume / maxVolume) * 100;
          const badDebtPct = pool.volume > 0 ? (pool.badDebt / pool.volume) * 100 : 0;

          return (
            <div key={pool.poolId} className={`rounded-lg border p-4 ${colors.bg} ${colors.border}`}>
              {/* Asset header */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-lg font-bold ${colors.text}`}>{pool.asset}</span>
                <span className="text-xs text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-full">
                  {pool.count} liq{pool.count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Volume bar */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full bg-gradient-to-r ${colors.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(volumePct, 3)}%` }}
                />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Volume</div>
                  <div className="text-sm font-semibold text-white tabular-nums">{formatVolume(pool.volume)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Avg Size</div>
                  <div className="text-sm font-semibold text-white/80 tabular-nums">{formatVolume(pool.avgSize)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Rewards</div>
                  <div className="text-sm font-semibold text-emerald-400 tabular-nums">{formatVolume(pool.rewards)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Bad Debt</div>
                  <div className={`text-sm font-semibold tabular-nums ${pool.badDebt > 0 ? 'text-rose-400' : 'text-white/30'}`}>
                    {pool.badDebt > 0 ? `${formatVolume(pool.badDebt)} (${badDebtPct.toFixed(1)}%)` : '0'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2. Risk Ratio Distribution ───────────────────────────────────────────────

function RiskRatioDistribution({ liquidations }: { liquidations: LiquidationEventResponse[] }) {
  const { buckets, stats } = React.useMemo(() => {
    const ratios = liquidations
      .map((liq) => parseFloat(liq.risk_ratio) / 1e9)
      .filter((r) => r > 0 && r < 10); // Filter sane values

    if (ratios.length === 0) return { buckets: [], stats: { median: 0, min: 0, max: 0, avg: 0 } };

    const sorted = [...ratios].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;

    // Create buckets from 0.8 to 1.2 (typical liquidation zone)
    const bucketEdges = [0, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20, Infinity];
    const bucketCounts: { label: string; count: number; isLiqZone: boolean }[] = [];

    for (let i = 0; i < bucketEdges.length - 1; i++) {
      const low = bucketEdges[i];
      const high = bucketEdges[i + 1];
      const count = ratios.filter((r) => r >= low && r < high).length;
      const label = high === Infinity ? `>${low.toFixed(2)}` : `${low.toFixed(2)}`;
      bucketCounts.push({ label, count, isLiqZone: low >= 0.95 && low < 1.05 });
    }

    return { buckets: bucketCounts.filter((b) => b.count > 0), stats: { median, min, max, avg } };
  }, [liquidations]);

  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
      <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Risk Ratio at Liquidation
      </h4>
      <p className="text-xs text-white/40 mb-3">
        How risky were positions when liquidated? (1.0 = liquidation threshold)
      </p>

      {/* Stats summary */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div>
          <span className="text-white/40">Median: </span>
          <span className="text-amber-400 font-semibold tabular-nums">{stats.median.toFixed(3)}</span>
        </div>
        <div>
          <span className="text-white/40">Range: </span>
          <span className="text-white/60 font-mono tabular-nums">{stats.min.toFixed(3)} – {stats.max.toFixed(3)}</span>
        </div>
      </div>

      {/* Histogram */}
      <div className="flex items-end gap-1.5 h-28">
        {buckets.map((bucket, idx) => {
          const heightPct = (bucket.count / maxCount) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 rounded bg-slate-800 border border-white/10 text-xs text-white whitespace-nowrap shadow-lg">
                {bucket.count} liquidation{bucket.count !== 1 ? 's' : ''} at {bucket.label}
              </div>
              {/* Count label */}
              {bucket.count > 0 && heightPct > 25 && (
                <span className="text-xs text-white/50 tabular-nums">{bucket.count}</span>
              )}
              {/* Bar */}
              <div
                className={`w-full rounded-t transition-all ${
                  bucket.isLiqZone
                    ? 'bg-gradient-to-t from-rose-500 to-rose-400'
                    : 'bg-gradient-to-t from-teal-600 to-teal-400'
                } group-hover:opacity-80`}
                style={{ height: `${Math.max(heightPct, 4)}%` }}
              />
              {/* Label */}
              <span className="text-[11px] text-white/40 tabular-nums leading-none">{bucket.label}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-white/40">Near threshold (0.95–1.05)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
          <span className="text-white/40">Other ranges</span>
        </div>
      </div>
    </div>
  );
}

// ─── 3. Repeat Liquidation Tracker ────────────────────────────────────────────

function RepeatLiquidationTracker({
  liquidations,
  poolIdToAsset,
}: {
  liquidations: LiquidationEventResponse[];
  poolIdToAsset: Map<string, string>;
}) {
  const repeats = React.useMemo(() => {
    const map = new Map<
      string,
      { count: number; totalVolume: number; totalBadDebt: number; lastTime: number; poolId: string }
    >();

    liquidations.forEach((liq) => {
      const id = liq.margin_manager_id;
      const existing = map.get(id) || { count: 0, totalVolume: 0, totalBadDebt: 0, lastTime: 0, poolId: liq.margin_pool_id };
      existing.count += 1;
      existing.totalVolume += parseFloat(liq.liquidation_amount) / 1e9;
      existing.totalBadDebt += parseFloat(liq.pool_default) / 1e9;
      existing.lastTime = Math.max(existing.lastTime, liq.checkpoint_timestamp_ms);
      existing.poolId = liq.margin_pool_id;
      map.set(id, existing);
    });

    return Array.from(map.entries())
      .filter(([, stats]) => stats.count >= 2)
      .map(([id, stats]) => ({
        marginManagerId: id,
        ...stats,
        pool: poolIdToAsset.get(stats.poolId) || 'Unknown',
      }))
      .sort((a, b) => b.count - a.count);
  }, [liquidations, poolIdToAsset]);

  if (repeats.length === 0) {
    return (
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
        <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Repeat Liquidations
        </h4>
        <p className="text-xs text-white/40 mt-1">No positions have been liquidated more than once in this period</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Repeat Liquidations
          </h4>
          <p className="text-[10px] text-white/40 mt-0.5">Positions liquidated multiple times — signals persistent risk</p>
        </div>
        <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/20 font-semibold">
          {repeats.length} repeat{repeats.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {repeats.slice(0, 8).map((r) => (
          <div key={r.marginManagerId} className="flex items-center gap-3 py-2.5 group hover:bg-white/[0.02] -mx-2 px-2 rounded transition-colors">
            {/* Hit count badge */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
              r.count >= 5 ? 'bg-rose-500/20 text-rose-400' :
              r.count >= 3 ? 'bg-amber-500/20 text-amber-400' :
              'bg-purple-500/20 text-purple-400'
            }`}>
              {r.count}×
            </div>

            {/* Position ID + Pool */}
            <div className="flex-1 min-w-0">
              <a
                href={`https://suivision.xyz/object/${r.marginManagerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 text-xs font-mono flex items-center gap-1"
              >
                {formatAddress(r.marginManagerId)}
                <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <span className="text-[10px] text-white/30">{r.pool} pool</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <div className="font-semibold text-white tabular-nums">{formatVolume(r.totalVolume)}</div>
                <div className="text-[10px] text-white/30">total vol</div>
              </div>
              {r.totalBadDebt > 0 && (
                <div className="text-right">
                  <div className="font-semibold text-rose-400 tabular-nums">{formatVolume(r.totalBadDebt)}</div>
                  <div className="text-[10px] text-white/30">bad debt</div>
                </div>
              )}
              <div className="text-right">
                <div className="font-medium text-white/60 tabular-nums">
                  {new Date(r.lastTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-[10px] text-white/30">last liq</div>
              </div>
            </div>
          </div>
        ))}
        {repeats.length > 8 && (
          <div className="text-center py-2 text-white/30 text-xs">
            + {repeats.length - 8} more repeat positions
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 4. Liquidation Size Distribution ─────────────────────────────────────────

function SizeDistribution({ liquidations }: { liquidations: LiquidationEventResponse[] }) {
  const { buckets, stats } = React.useMemo(() => {
    const amounts = liquidations.map((liq) => parseFloat(liq.liquidation_amount) / 1e9).filter((a) => a > 0);
    if (amounts.length === 0) return { buckets: [], stats: { median: 0, p90: 0, largest: 0 } };

    const sorted = [...amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const largest = sorted[sorted.length - 1];

    // Dynamic buckets based on data range
    const bucketEdges = [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, Infinity];
    const bucketData: { label: string; count: number; totalVolume: number }[] = [];

    for (let i = 0; i < bucketEdges.length - 1; i++) {
      const low = bucketEdges[i];
      const high = bucketEdges[i + 1];
      const matching = amounts.filter((a) => a >= low && a < high);
      if (matching.length > 0) {
        const label = high === Infinity ? `${formatVolume(low)}+` : `${formatVolume(low)}–${formatVolume(high)}`;
        bucketData.push({ label, count: matching.length, totalVolume: matching.reduce((s, a) => s + a, 0) });
      }
    }

    return { buckets: bucketData, stats: { median, p90, largest } };
  }, [liquidations]);

  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
      <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Liquidation Size Distribution
      </h4>
      <p className="text-xs text-white/40 mb-3">Are liquidations mostly small dust or large positions?</p>

      {/* Stats summary */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div>
          <span className="text-white/40">Median: </span>
          <span className="text-teal-400 font-semibold tabular-nums">{formatVolume(stats.median)}</span>
        </div>
        <div>
          <span className="text-white/40">P90: </span>
          <span className="text-white/60 tabular-nums">{formatVolume(stats.p90)}</span>
        </div>
        <div>
          <span className="text-white/40">Largest: </span>
          <span className="text-white/60 tabular-nums">{formatVolume(stats.largest)}</span>
        </div>
      </div>

      {/* Histogram */}
      <div className="flex items-end gap-1.5 h-28">
        {buckets.map((bucket, idx) => {
          const heightPct = (bucket.count / maxCount) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 rounded bg-slate-800 border border-white/10 text-xs text-white whitespace-nowrap shadow-lg">
                {bucket.count} ({formatVolume(bucket.totalVolume)} total)
              </div>
              {bucket.count > 0 && heightPct > 25 && (
                <span className="text-xs text-white/50 tabular-nums">{bucket.count}</span>
              )}
              <div
                className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400 group-hover:opacity-80 transition-all"
                style={{ height: `${Math.max(heightPct, 4)}%` }}
              />
              <span className="text-[11px] text-white/40 tabular-nums leading-none whitespace-nowrap">{bucket.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 5. Cumulative Volume Over Time ───────────────────────────────────────────

function CumulativeVolumeChart({ liquidations }: { liquidations: LiquidationEventResponse[] }) {
  const chartData = React.useMemo(() => {
    const sorted = [...liquidations].sort((a, b) => a.checkpoint_timestamp_ms - b.checkpoint_timestamp_ms);

    let cumulative = 0;
    const points: { timestamp: number; cumulative: number; date: string }[] = [];

    sorted.forEach((liq) => {
      cumulative += parseFloat(liq.liquidation_amount) / 1e9;
      const date = new Date(liq.checkpoint_timestamp_ms).toISOString().split('T')[0];
      // Deduplicate by day - keep the last point for each day
      if (points.length > 0 && points[points.length - 1].date === date) {
        points[points.length - 1].cumulative = cumulative;
      } else {
        points.push({ timestamp: liq.checkpoint_timestamp_ms, cumulative, date });
      }
    });

    return points;
  }, [liquidations]);

  if (chartData.length < 2) return null;

  const chartHeight = 100;
  const paddingLeft = 45;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 25;
  const width = 600;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const maxCumulative = chartData[chartData.length - 1].cumulative;
  const minTime = chartData[0].timestamp;
  const maxTime = chartData[chartData.length - 1].timestamp;
  const timeRange = maxTime - minTime || 1;

  const xScale = (ts: number) => paddingLeft + ((ts - minTime) / timeRange) * innerWidth;
  const yScale = (val: number) => paddingTop + innerHeight - (val / maxCumulative) * innerHeight;

  const linePath = chartData
    .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(d.timestamp)} ${yScale(d.cumulative)}`)
    .join(' ');

  const areaPath = `${linePath} L ${xScale(maxTime)} ${paddingTop + innerHeight} L ${xScale(minTime)} ${paddingTop + innerHeight} Z`;

  return (
    <div className="bg-gradient-to-r from-white/[0.04] to-white/[0.01] rounded-xl border border-white/[0.06] p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Cumulative Liquidation Volume
          </h3>
          <p className="text-xs text-white/40 mt-0.5">Total risk processed by the protocol over time</p>
        </div>
        <div className="text-right px-3 py-2 bg-white/[0.04] rounded-lg border border-white/[0.06]">
          <div className="text-white font-bold text-sm tabular-nums">{formatVolume(maxCumulative)}</div>
          <div className="text-white/40 text-[10px]">total volume</div>
        </div>
      </div>

      <div className="relative bg-white/[0.02] rounded-lg p-2 border border-white/[0.04]">
        <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={paddingLeft}
              y1={paddingTop + innerHeight * (1 - ratio)}
              x2={paddingLeft + innerWidth}
              y2={paddingTop + innerHeight * (1 - ratio)}
              stroke="white"
              strokeOpacity="0.04"
              strokeDasharray="4 4"
            />
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#cumulativeGradient)" />

          {/* Main line — subtle, no glow */}
          <path d={linePath} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* End dot */}
          <circle cx={xScale(maxTime)} cy={yScale(maxCumulative)} r="3" fill="rgba(255,255,255,0.6)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

          {/* Y-axis labels */}
          <text x={paddingLeft - 5} y={paddingTop + 4} textAnchor="end" className="fill-white/40 text-[9px] font-medium">
            {formatVolume(maxCumulative)}
          </text>
          <text x={paddingLeft - 5} y={paddingTop + innerHeight} textAnchor="end" className="fill-white/40 text-[9px] font-medium">
            0
          </text>

          {/* X-axis labels */}
          {chartData.filter((_, idx) => idx === 0 || idx === chartData.length - 1 || idx === Math.floor(chartData.length / 2)).map((d) => (
            <text
              key={d.date}
              x={xScale(d.timestamp)}
              y={paddingTop + innerHeight + 15}
              textAnchor="middle"
              className="fill-white/40 text-[9px] font-medium"
            >
              {new Date(d.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </text>
          ))}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

// ─── 6. Time-of-Day Heatmap ──────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];

function TimeHeatmap({ liquidations }: { liquidations: LiquidationEventResponse[] }) {
  const heatmapData = React.useMemo(() => {
    // 7 days × 8 time blocks (3-hour windows)
    const grid: number[][] = Array.from({ length: 7 }, () => Array(8).fill(0));
    let totalEvents = 0;

    liquidations.forEach((liq) => {
      const date = new Date(liq.checkpoint_timestamp_ms);
      const day = date.getUTCDay(); // 0 = Sunday
      const hour = date.getUTCHours();
      const block = Math.floor(hour / 3); // 0-7 (3-hour blocks)
      grid[day][block] += 1;
      totalEvents += 1;
    });

    const maxCount = Math.max(...grid.flat(), 1);

    // Find peak time
    let peakDay = 0;
    let peakBlock = 0;
    let peakCount = 0;
    grid.forEach((row, day) => {
      row.forEach((count, block) => {
        if (count > peakCount) {
          peakCount = count;
          peakDay = day;
          peakBlock = block;
        }
      });
    });

    return { grid, maxCount, totalEvents, peakDay, peakBlock, peakCount };
  }, [liquidations]);

  if (heatmapData.totalEvents < 3) return null;

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-white/[0.02]';
    const intensity = count / heatmapData.maxCount;
    if (intensity > 0.75) return 'bg-rose-500/70';
    if (intensity > 0.5) return 'bg-amber-500/50';
    if (intensity > 0.25) return 'bg-teal-500/40';
    return 'bg-teal-500/20';
  };

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Liquidation Time Patterns
          </h4>
          <p className="text-[10px] text-white/40 mt-0.5">When do liquidations cluster? (UTC, 3-hour blocks)</p>
        </div>
        <div className="text-xs text-white/50">
          Peak: <span className="text-rose-400 font-semibold">
            {DAY_NAMES[heatmapData.peakDay]} {HOUR_LABELS[heatmapData.peakBlock]}
          </span>
          <span className="text-white/30 ml-1">({heatmapData.peakCount} events)</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="space-y-1">
        {/* Hour labels row */}
        <div className="flex items-center gap-1 pl-10">
          {HOUR_LABELS.map((label) => (
            <div key={label} className="flex-1 text-center text-[9px] text-white/30">{label}</div>
          ))}
        </div>

        {/* Day rows */}
        {heatmapData.grid.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1">
            <div className="w-9 text-right text-[10px] text-white/40 font-medium pr-1">{DAY_NAMES[dayIdx]}</div>
            {row.map((count, blockIdx) => (
              <div
                key={blockIdx}
                className={`flex-1 h-7 rounded-sm ${getColor(count)} flex items-center justify-center transition-all hover:ring-1 hover:ring-white/20 cursor-default group relative`}
              >
                {count > 0 && (
                  <span className="text-[9px] text-white/70 font-medium tabular-nums">{count}</span>
                )}
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 rounded bg-slate-800 border border-white/10 text-[10px] text-white whitespace-nowrap shadow-lg">
                  {DAY_NAMES[dayIdx]} {HOUR_LABELS[blockIdx]}–{HOUR_LABELS[(blockIdx + 1) % 8] || '12a'}: {count} liquidation{count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-white/[0.04]">
        <span className="text-[10px] text-white/30">Less</span>
        <div className="flex items-center gap-0.5">
          <span className="w-4 h-3 rounded-sm bg-white/[0.02] border border-white/[0.06]" />
          <span className="w-4 h-3 rounded-sm bg-teal-500/20" />
          <span className="w-4 h-3 rounded-sm bg-teal-500/40" />
          <span className="w-4 h-3 rounded-sm bg-amber-500/50" />
          <span className="w-4 h-3 rounded-sm bg-rose-500/70" />
        </div>
        <span className="text-[10px] text-white/30">More</span>
      </div>
    </div>
  );
}

// ─── Main Exported Component ──────────────────────────────────────────────────

export function LiquidationInsights({ liquidations, isLoading }: LiquidationInsightsProps) {
  const poolIdToAsset = usePoolIdToAsset();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" />
          <div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (liquidations.length === 0) {
    return null; // Let the parent handle the empty state
  }

  return (
    <div className="space-y-4">
      {/* Pool Breakdown Cards */}
      <PoolBreakdownSection liquidations={liquidations} poolIdToAsset={poolIdToAsset} />

      {/* Cumulative Volume Chart */}
      <CumulativeVolumeChart liquidations={liquidations} />

      {/* Two-column: Risk Ratio Distribution + Size Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RiskRatioDistribution liquidations={liquidations} />
        <SizeDistribution liquidations={liquidations} />
      </div>

      {/* Two-column: Repeat Liquidations + Time Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RepeatLiquidationTracker liquidations={liquidations} poolIdToAsset={poolIdToAsset} />
        <TimeHeatmap liquidations={liquidations} />
      </div>
    </div>
  );
}
