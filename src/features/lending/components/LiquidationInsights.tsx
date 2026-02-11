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
    <div className="surface-elevated p-6">
      <h3 className="text-base font-semibold text-white mb-1">Liquidations by Pool</h3>
      <p className="text-xs text-white/40 mb-4">Which lending pools see the most liquidation activity</p>

      <div className={`grid gap-4 ${
        poolStats.length === 1 ? 'grid-cols-1 sm:max-w-md' :
        poolStats.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
        poolStats.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }`}>
        {poolStats.map((pool) => {
          const colors = poolColors[pool.asset] || defaultColors;
          const volumePct = (pool.volume / maxVolume) * 100;
          const badDebtPct = pool.volume > 0 ? (pool.badDebt / pool.volume) * 100 : 0;

          return (
            <div key={pool.poolId} className={`rounded-xl border p-5 ${colors.bg} ${colors.border}`}>
              {/* Asset header */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-lg font-bold ${colors.text}`}>{pool.asset}</span>
                <span className="text-xs text-white/50 bg-white/[0.08] px-2.5 py-1 rounded-full font-medium">
                  {pool.count.toLocaleString()} liq{pool.count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Volume bar */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full bg-gradient-to-r ${colors.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(volumePct, 3)}%` }}
                />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Volume</div>
                  <div className="text-base font-bold text-white tabular-nums">{formatVolume(pool.volume)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Avg Size</div>
                  <div className="text-base font-bold text-white/80 tabular-nums">{formatVolume(pool.avgSize)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Rewards</div>
                  <div className="text-base font-bold text-emerald-400 tabular-nums">{formatVolume(pool.rewards)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Bad Debt</div>
                  <div className={`text-base font-bold tabular-nums ${pool.badDebt >= 0.01 ? 'text-rose-400' : 'text-white/30'}`}>
                    {pool.badDebt >= 0.01
                      ? `${formatVolume(pool.badDebt)} (${badDebtPct.toFixed(1)}%)`
                      : pool.badDebt > 0
                        ? `<0.01 (${badDebtPct.toFixed(1)}%)`
                        : '0'
                    }
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
      .filter((r) => r > 0 && r < 10);

    if (ratios.length === 0) return { buckets: [], stats: { median: 0, min: 0, max: 0, avg: 0, total: 0 } };

    const sorted = [...ratios].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;

    const bucketEdges = [0, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20, Infinity];
    const bucketCounts: { label: string; count: number; isLiqZone: boolean }[] = [];

    for (let i = 0; i < bucketEdges.length - 1; i++) {
      const low = bucketEdges[i];
      const high = bucketEdges[i + 1];
      const count = ratios.filter((r) => r >= low && r < high).length;
      const label = high === Infinity ? `>${low.toFixed(2)}` : `${low.toFixed(2)}`;
      bucketCounts.push({ label, count, isLiqZone: low >= 0.95 && low < 1.05 });
    }

    return { buckets: bucketCounts.filter((b) => b.count > 0), stats: { median, min, max, avg, total: ratios.length } };
  }, [liquidations]);

  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h4 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Risk Ratio at Liquidation
          </h4>
          <p className="text-sm text-white/40 mt-1">
            How risky were positions when liquidated? 1.0 = liquidation threshold.
          </p>
        </div>
      </div>

      {/* Hero stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
          <div className="text-xs text-white/40 mb-1">Median</div>
          <div className="text-2xl font-bold text-amber-400 tabular-nums">{stats.median.toFixed(3)}</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
          <div className="text-xs text-white/40 mb-1">Range</div>
          <div className="text-lg font-semibold text-white/70 tabular-nums">{stats.min.toFixed(3)} – {stats.max.toFixed(3)}</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
          <div className="text-xs text-white/40 mb-1">Positions</div>
          <div className="text-2xl font-bold text-white tabular-nums">{stats.total.toLocaleString()}</div>
        </div>
      </div>

      {/* Horizontal bar breakdown */}
      <div className="space-y-2">
        <div className="flex items-center text-xs text-white/30 font-medium mb-1 px-1">
          <span className="w-28">Risk Ratio</span>
          <span className="flex-1">Distribution</span>
          <span className="w-16 text-right">Count</span>
          <span className="w-14 text-right">%</span>
        </div>
        {buckets.map((bucket, idx) => {
          const pct = stats.total > 0 ? (bucket.count / stats.total) * 100 : 0;
          const barWidth = (bucket.count / maxCount) * 100;
          return (
            <div key={idx} className="flex items-center gap-2 group hover:bg-white/[0.02] rounded-lg px-1 py-1.5 transition-colors">
              {/* Bucket label */}
              <span className={`w-28 text-sm font-medium tabular-nums shrink-0 ${
                bucket.isLiqZone ? 'text-rose-400' : 'text-white/60'
              }`}>
                {bucket.label}
                {bucket.isLiqZone && <span className="text-rose-400/50 text-xs ml-1">⚠</span>}
              </span>
              {/* Bar */}
              <div className="flex-1 h-6 bg-white/[0.03] rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${
                    bucket.isLiqZone
                      ? 'bg-gradient-to-r from-rose-600/60 to-rose-400/80'
                      : 'bg-gradient-to-r from-teal-600/60 to-teal-400/80'
                  }`}
                  style={{ width: `${Math.max(barWidth, 1)}%` }}
                />
              </div>
              {/* Count */}
              <span className="w-16 text-right text-sm font-semibold text-white tabular-nums">
                {bucket.count.toLocaleString()}
              </span>
              {/* Percentage */}
              <span className="w-14 text-right text-sm text-white/40 tabular-nums">
                {pct < 0.1 && pct > 0 ? '<0.1' : pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-sm bg-rose-500" />
          <span className="text-white/50">Near threshold (0.95–1.05)</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-sm bg-teal-500" />
          <span className="text-white/50">Other ranges</span>
        </div>
      </div>
    </div>
  );
}

// ─── 3. Repeat Liquidation Tracker ────────────────────────────────────────────

/**
 * Inline timeline chart for a single position's liquidation history.
 * Shows each event as a stem-and-dot (lollipop) on a time axis with size on the y-axis.
 * Includes hover tooltips on each data point.
 */
function PositionTimelineChart({
  events,
}: {
  events: LiquidationEventResponse[];
}) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const sorted = React.useMemo(
    () => [...events].sort((a, b) => a.checkpoint_timestamp_ms - b.checkpoint_timestamp_ms),
    [events],
  );

  if (sorted.length === 0) return null;

  const width = 520;
  const height = 110;
  const pl = 50; // padding left
  const pr = 16;
  const pt = 14;
  const pb = 22;
  const innerW = width - pl - pr;
  const innerH = height - pt - pb;

  const amounts = sorted.map((e) => parseFloat(e.liquidation_amount) / 1e9);
  const maxAmt = Math.max(...amounts, 0.001);
  const minTime = sorted[0].checkpoint_timestamp_ms;
  const maxTime = sorted[sorted.length - 1].checkpoint_timestamp_ms;
  const timeSpan = maxTime - minTime || 1;

  const x = (ts: number) => pl + ((ts - minTime) / timeSpan) * innerW;
  const y = (amt: number) => pt + innerH - (amt / maxAmt) * innerH;

  return (
    <div ref={containerRef} className="mt-3 bg-white/[0.02] rounded-lg border border-white/[0.04] p-3 relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">Liquidation History</span>
        <span className="text-[10px] text-white/30">{sorted.length} events</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid lines */}
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={pl}
            y1={pt + innerH * (1 - ratio)}
            x2={pl + innerW}
            y2={pt + innerH * (1 - ratio)}
            stroke="white"
            strokeOpacity="0.04"
            strokeDasharray="3 3"
          />
        ))}

        {/* Hover crosshair line */}
        {hoveredIdx !== null && (
          <line
            x1={x(sorted[hoveredIdx].checkpoint_timestamp_ms)}
            y1={pt}
            x2={x(sorted[hoveredIdx].checkpoint_timestamp_ms)}
            y2={pt + innerH}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="2 2"
          />
        )}

        {/* Lollipop stems + dots */}
        {sorted.map((evt, i) => {
          const amt = amounts[i];
          const cx = x(evt.checkpoint_timestamp_ms);
          const cy = y(amt);
          const hasBadDebt = parseFloat(evt.pool_default) > 0;
          const isHovered = hoveredIdx === i;
          const dotR = isHovered ? 6 : 4;
          return (
            <g key={i} style={{ cursor: 'pointer' }}>
              {/* Hit area (invisible, wider target) */}
              <circle
                cx={cx} cy={cy} r={12}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
              />
              {/* Stem */}
              <line
                x1={cx} y1={pt + innerH}
                x2={cx} y2={cy}
                stroke={hasBadDebt ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.15)'}
                strokeWidth={isHovered ? 2 : 1}
                style={{ transition: 'stroke-width 0.15s ease' }}
              />
              {/* Glow on hover */}
              {isHovered && (
                <circle
                  cx={cx} cy={cy} r={10}
                  fill={hasBadDebt ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.08)'}
                />
              )}
              {/* Dot */}
              <circle
                cx={cx} cy={cy} r={dotR}
                fill={hasBadDebt ? 'rgba(244,63,94,0.7)' : isHovered ? 'rgba(45,212,191,0.8)' : 'rgba(255,255,255,0.5)'}
                stroke={hasBadDebt ? 'rgba(244,63,94,0.3)' : isHovered ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.1)'}
                strokeWidth="1.5"
                style={{ transition: 'r 0.15s ease, fill 0.15s ease' }}
              />
              {/* Value label on dot */}
              <text
                x={cx} y={cy - (isHovered ? 10 : 7)}
                textAnchor="middle"
                className="fill-white/60 font-medium"
                style={{ fontSize: isHovered ? '9px' : '8px', fontWeight: isHovered ? 600 : 500, transition: 'font-size 0.15s ease' }}
              >
                {formatVolume(amt)}
              </text>
            </g>
          );
        })}

        {/* Hover tooltip as foreignObject */}
        {hoveredIdx !== null && (() => {
          const evt = sorted[hoveredIdx];
          const amt = amounts[hoveredIdx];
          const reward = parseFloat(evt.pool_reward) / 1e9;
          const debt = parseFloat(evt.pool_default) / 1e9;
          const hasBadDebt = debt > 0;
          const cx = x(evt.checkpoint_timestamp_ms);
          // Position tooltip to avoid overflow
          const tooltipW = 140;
          const tooltipH = hasBadDebt ? 70 : 56;
          const tooltipX = Math.max(pl, Math.min(cx - tooltipW / 2, width - pr - tooltipW));
          const tooltipY = Math.max(0, y(amt) - tooltipH - 14);

          return (
            <foreignObject x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  background: 'rgba(10, 20, 25, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px', fontWeight: 500 }}>
                  {new Date(evt.checkpoint_timestamp_ms).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#fff', fontWeight: 600 }}>
                  <span>Amount</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{amt >= 0.01 ? amt.toFixed(2) : '<0.01'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#10b981', marginTop: '2px' }}>
                  <span>Reward</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{reward >= 0.01 ? reward.toFixed(2) : '<0.01'}</span>
                </div>
                {hasBadDebt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#f87171', marginTop: '2px' }}>
                    <span>Bad Debt</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{debt >= 0.01 ? debt.toFixed(2) : '<0.01'}</span>
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })()}

        {/* Y-axis labels */}
        <text x={pl - 4} y={pt + 4} textAnchor="end" className="fill-white/30" style={{ fontSize: '8px' }}>
          {formatVolume(maxAmt)}
        </text>
        <text x={pl - 4} y={pt + innerH + 1} textAnchor="end" className="fill-white/30" style={{ fontSize: '8px' }}>
          0
        </text>

        {/* X-axis date labels */}
        {sorted.map((evt, i) => (
          <text
            key={i}
            x={x(evt.checkpoint_timestamp_ms)}
            y={pt + innerH + 14}
            textAnchor="middle"
            className={hoveredIdx === i ? 'fill-white/70' : 'fill-white/30'}
            style={{ fontSize: '8px', fontWeight: hoveredIdx === i ? 600 : 400, transition: 'fill 0.15s ease' }}
          >
            {new Date(evt.checkpoint_timestamp_ms).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>

      {/* Event detail row */}
      <div className="mt-2 space-y-1">
        {sorted.map((evt, i) => {
          const amt = amounts[i];
          const reward = parseFloat(evt.pool_reward) / 1e9;
          const debt = parseFloat(evt.pool_default) / 1e9;
          const hasBadDebt = debt > 0;
          const isHighlighted = hoveredIdx === i;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-[11px] transition-colors rounded px-1 -mx-1 ${
                isHighlighted ? 'bg-white/[0.04] text-white/70' : 'text-white/50'
              }`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'default' }}
            >
              <span className={`tabular-nums w-28 shrink-0 ${isHighlighted ? 'text-white/50' : 'text-white/30'}`}>
                {new Date(evt.checkpoint_timestamp_ms).toLocaleString([], {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <span className="text-white font-medium tabular-nums">${amt > 0 && amt < 0.01 ? '<0.01' : amt.toFixed(2)}</span>
              <span className="text-white/20">·</span>
              <span className="text-emerald-400/70 tabular-nums">
                reward {reward > 0 && reward < 0.01 ? '<0.01' : reward.toFixed(2)}
              </span>
              {hasBadDebt && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-rose-400/70 tabular-nums">
                    bad debt {debt < 0.01 ? '<0.01' : debt.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepeatLiquidationTracker({
  liquidations,
  poolIdToAsset,
}: {
  liquidations: LiquidationEventResponse[];
  poolIdToAsset: Map<string, string>;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

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

  // Build a lookup of events per manager, only when one is expanded
  const expandedEvents = React.useMemo(() => {
    if (!expandedId) return [];
    return liquidations
      .filter((liq) => liq.margin_manager_id === expandedId)
      .sort((a, b) => a.checkpoint_timestamp_ms - b.checkpoint_timestamp_ms);
  }, [liquidations, expandedId]);

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
          <p className="text-[10px] text-white/40 mt-0.5">Positions liquidated multiple times — click to see history</p>
        </div>
        <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/20 font-semibold">
          {repeats.length} repeat{repeats.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {repeats.slice(0, 8).map((r) => {
          const isExpanded = expandedId === r.marginManagerId;
          return (
            <div key={r.marginManagerId}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : r.marginManagerId)}
                className="w-full flex items-center gap-3 py-2.5 hover:bg-white/[0.02] -mx-2 px-2 rounded transition-colors text-left cursor-pointer"
              >
                {/* Hit count badge */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  r.count >= 5 ? 'bg-rose-500/20 text-rose-400' :
                  r.count >= 3 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-purple-500/20 text-purple-400'
                }`}>
                  {r.count}×
                </div>

                {/* Position ID + Pool */}
                <div className="flex-1 min-w-0">
                  <span className="text-cyan-400 text-xs font-mono flex items-center gap-1">
                    {formatAddress(r.marginManagerId)}
                    <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </span>
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

                {/* Expand chevron */}
                <svg
                  className={`w-4 h-4 text-white/30 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded timeline chart */}
              {isExpanded && (
                <div className="pb-3 -mx-2 px-2">
                  <PositionTimelineChart events={expandedEvents} />
                  <div className="mt-2 text-center">
                    <a
                      href={`https://suivision.xyz/object/${r.marginManagerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
                    >
                      View position on SuiVision →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
    if (amounts.length === 0) return { buckets: [], stats: { median: 0, p90: 0, largest: 0, total: 0 } };

    const sorted = [...amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const largest = sorted[sorted.length - 1];

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

    return { buckets: bucketData, stats: { median, p90, largest, total: amounts.length } };
  }, [liquidations]);

  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h4 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Liquidation Size Distribution
          </h4>
          <p className="text-sm text-white/40 mt-1">
            Are liquidations mostly small dust or large positions?
          </p>
        </div>
      </div>

      {/* Hero stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
          <div className="text-xs text-white/40 mb-1">Median Size</div>
          <div className="text-2xl font-bold text-teal-400 tabular-nums">{formatVolume(stats.median)}</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
          <div className="text-xs text-white/40 mb-1">P90</div>
          <div className="text-lg font-semibold text-white/70 tabular-nums">{formatVolume(stats.p90)}</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
          <div className="text-xs text-white/40 mb-1">Largest</div>
          <div className="text-2xl font-bold text-white tabular-nums">{formatVolume(stats.largest)}</div>
        </div>
      </div>

      {/* Horizontal bar breakdown */}
      <div className="space-y-2">
        <div className="flex items-center text-xs text-white/30 font-medium mb-1 px-1">
          <span className="w-32">Size Range</span>
          <span className="flex-1">Distribution</span>
          <span className="w-16 text-right">Count</span>
          <span className="w-14 text-right">%</span>
        </div>
        {buckets.map((bucket, idx) => {
          const pct = stats.total > 0 ? (bucket.count / stats.total) * 100 : 0;
          const barWidth = (bucket.count / maxCount) * 100;
          return (
            <div key={idx} className="flex items-center gap-2 group hover:bg-white/[0.02] rounded-lg px-1 py-1.5 transition-colors">
              {/* Bucket label */}
              <span className="w-32 text-sm font-medium text-white/60 tabular-nums shrink-0 whitespace-nowrap">
                {bucket.label}
              </span>
              {/* Bar */}
              <div className="flex-1 h-6 bg-white/[0.03] rounded overflow-hidden">
                <div
                  className="h-full rounded bg-gradient-to-r from-cyan-600/60 to-cyan-400/80 transition-all"
                  style={{ width: `${Math.max(barWidth, 1)}%` }}
                />
              </div>
              {/* Count */}
              <span className="w-16 text-right text-sm font-semibold text-white tabular-nums">
                {bucket.count.toLocaleString()}
              </span>
              {/* Percentage */}
              <span className="w-14 text-right text-sm text-white/40 tabular-nums">
                {pct < 0.1 && pct > 0 ? '<0.1' : pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 5. Time-of-Day Heatmap ──────────────────────────────────────────────────

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
