import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  type TooltipProps,
} from 'recharts';
import { type LiquidationEventResponse } from '../api/events';
import { useChartFirstRender, useStableGradientId } from '../../../components/charts/StableChart';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface BadDebtTimelineProps {
  liquidations: LiquidationEventResponse[];
  isLoading: boolean;
}

interface DayData {
  date: string;
  label: string;
  timestamp: number;
  liquidationCount: number;
  badDebt: number;
  rewards: number;
}

// ─── Nerid Theme Colors ─────────────────────────────────────────────────────────

const NERID = {
  primary:      '#2dd4bf',
  primaryMuted: '#14b8a6',
  primaryFaint: 'rgba(45, 212, 191, 0.15)',
  danger:       '#f87171',
  dangerMuted:  'rgba(248, 113, 113, 0.15)',
  success:      '#10b981',
  bgTooltip:    'rgba(10, 20, 25, 0.95)',
  borderTooltip: 'rgba(255, 255, 255, 0.1)',
  gridLine:     'rgba(255, 255, 255, 0.04)',
  textMuted:    'rgba(255, 255, 255, 0.35)',
  textFaint:    'rgba(255, 255, 255, 0.5)',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function groupByDay(liquidations: LiquidationEventResponse[]): DayData[] {
  const dayMap = new Map<string, { count: number; badDebt: number; rewards: number; timestamp: number }>();

  liquidations.forEach((liq) => {
    const date = new Date(liq.checkpoint_timestamp_ms);
    const dateKey = date.toISOString().split('T')[0];
    const existing = dayMap.get(dateKey) || { count: 0, badDebt: 0, rewards: 0, timestamp: date.getTime() };
    existing.count += 1;
    existing.badDebt += parseFloat(liq.pool_default) / 1e9;
    existing.rewards += parseFloat(liq.pool_reward) / 1e9;
    dayMap.set(dateKey, existing);
  });

  return Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      label: new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      timestamp: data.timestamp,
      liquidationCount: data.count,
      badDebt: data.badDebt,
      rewards: data.rewards,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return value.toFixed(1);
  if (value > 0 && value < 0.01) return '<0.01';
  if (value > 0) return value.toFixed(2);
  return '0';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type ChartView = 'activity' | 'cumulative';

// ─── Custom Tooltips ────────────────────────────────────────────────────────────

function ActivityTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as DayData;
  if (!data) return null;

  return (
    <div
      className="rounded-xl shadow-2xl border backdrop-blur-sm"
      style={{ background: NERID.bgTooltip, borderColor: NERID.borderTooltip, minWidth: 180 }}
    >
      <div className="px-3.5 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="text-[11px] font-medium text-white/60">{formatDate(data.date)}</div>
      </div>
      <div className="px-3.5 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-xs text-white/70">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ background: data.badDebt > 0 ? NERID.danger : NERID.primaryMuted }}
            />
            Liquidations
          </span>
          <span className="text-xs font-semibold text-white tabular-nums">{data.liquidationCount}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-xs text-white/70">
            <span className="w-2 h-2 rounded-sm" style={{ background: NERID.success }} />
            Rewards
          </span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: NERID.success }}>
            {formatValue(data.rewards)}
          </span>
        </div>
        {data.badDebt > 0 && (
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-xs text-white/70">
              <span className="w-2 h-2 rounded-sm" style={{ background: NERID.danger }} />
              Bad Debt
            </span>
            <span className="text-xs font-semibold text-rose-400 tabular-nums">
              {formatValue(data.badDebt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CumulativeTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as { date: string; cumulative: number };
  if (!data) return null;

  return (
    <div
      className="rounded-xl shadow-2xl border backdrop-blur-sm"
      style={{ background: NERID.bgTooltip, borderColor: NERID.borderTooltip, minWidth: 180 }}
    >
      <div className="px-3.5 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="text-[11px] font-medium text-white/60">
          {new Date(data.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
      <div className="px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-xs text-white/70">
            <span className="w-2 h-2 rounded-sm" style={{ background: NERID.primary }} />
            Cumulative Volume
          </span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: NERID.primary }}>
            {formatValue(data.cumulative)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Chart ─────────────────────────────────────────────────────────────

function ActivityChart({
  liquidations,
  dailyData,
}: {
  liquidations: LiquidationEventResponse[];
  dailyData: DayData[];
}) {
  const { animationProps } = useChartFirstRender(dailyData.length > 0);

  const stats = React.useMemo(() => {
    if (dailyData.length === 0) return { worstDay: null, medianBadDebt: 0, totalBadDebtDays: 0 };
    const badDebtDays = dailyData.filter((d) => d.badDebt > 0);
    const worstDay = badDebtDays.reduce(
      (worst, day) => (day.badDebt > (worst?.badDebt || 0) ? day : worst),
      null as DayData | null,
    );
    const sortedBadDebt = [...dailyData.map((d) => d.badDebt)].sort((a, b) => a - b);
    const medianBadDebt = sortedBadDebt[Math.floor(sortedBadDebt.length / 2)] || 0;
    return { worstDay, medianBadDebt, totalBadDebtDays: badDebtDays.length };
  }, [dailyData]);

  const displayData = dailyData.slice(-30);
  const hasBadDebtLine = stats.totalBadDebtDays > 0;

  return (
    <>
      {/* Key stats pills */}
      <div className="flex items-center gap-2 mb-4">
        {stats.worstDay && stats.worstDay.badDebt >= 0.01 ? (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-md"
            style={{ background: NERID.dangerMuted, color: NERID.danger }}
          >
            Worst day: {formatValue(stats.worstDay.badDebt)} bad debt · {formatDate(stats.worstDay.date)}
          </span>
        ) : (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-md"
            style={{ background: NERID.primaryFaint, color: NERID.primary }}
          >
            {stats.worstDay ? '≈ 0 bad debt' : 'No bad debt'}
          </span>
        )}
        <span
          className="text-xs px-2.5 py-1 rounded-md"
          style={{ background: 'rgba(255,255,255,0.04)', color: NERID.textFaint }}
        >
          Median: {formatValue(stats.medianBadDebt)} / day
        </span>
      </div>

      {/* Recharts chart */}
      <div
        className="rounded-lg border p-3"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: NERID.gridLine }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={displayData} margin={{ top: 12, right: 8, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={NERID.gridLine} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: NERID.textMuted, fontSize: 10, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="count"
              tick={{ fill: NERID.textMuted, fontSize: 10, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={false}
            />
            {hasBadDebtLine && (
              <YAxis
                yAxisId="debt"
                orientation="right"
                tick={{ fill: 'rgba(248,113,113,0.5)', fontSize: 10, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={38}
                tickFormatter={(v: number) => formatValue(v)}
              />
            )}
            <Tooltip
              content={<ActivityTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 4 }}
            />
            <Bar
              yAxisId="count"
              dataKey="liquidationCount"
              radius={[4, 4, 0, 0] as [number, number, number, number]}
              maxBarSize={32}
              {...animationProps}
            >
              {displayData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.badDebt > 0 ? NERID.danger : NERID.primaryMuted}
                  fillOpacity={entry.badDebt > 0 ? 0.8 : 0.6}
                />
              ))}
            </Bar>
            {hasBadDebtLine && (
              <Line
                yAxisId="debt"
                type="monotone"
                dataKey="badDebt"
                stroke={NERID.danger}
                strokeWidth={2}
                strokeOpacity={0.8}
                dot={{ r: 3, fill: NERID.danger, stroke: '#0d1a1f', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: NERID.danger, stroke: '#0d1a1f', strokeWidth: 2 }}
                {...animationProps}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + verdict */}
      <div className="flex items-center gap-5 mt-3 text-[11px]" style={{ color: NERID.textFaint }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: NERID.primaryMuted, opacity: 0.65 }} />
          Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: NERID.danger, opacity: 0.85 }} />
          Days with bad debt
        </span>
        {stats.totalBadDebtDays > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 rounded-full" style={{ background: NERID.danger }} />
            Bad debt trend
          </span>
        )}
        <span className="ml-auto" style={{ color: NERID.textMuted }}>
          {stats.totalBadDebtDays === 0 ? (
            <>
              <span style={{ color: NERID.primary }}>✓</span> Zero bad debt across{' '}
              {liquidations.length} liquidations
            </>
          ) : stats.totalBadDebtDays === 1 ? (
            <>Single bad debt event — isolated incident</>
          ) : (
            <>{stats.totalBadDebtDays} days with bad debt</>
          )}
        </span>
      </div>
    </>
  );
}

// ─── Cumulative Volume Chart ────────────────────────────────────────────────────

function CumulativeChart({ liquidations }: { liquidations: LiquidationEventResponse[] }) {
  const gradientId = useStableGradientId('neridCumulative');
  const { animationProps } = useChartFirstRender(liquidations.length >= 2);

  const chartData = React.useMemo(() => {
    const sorted = [...liquidations].sort((a, b) => a.checkpoint_timestamp_ms - b.checkpoint_timestamp_ms);
    let cumulative = 0;
    const points: { timestamp: number; cumulative: number; date: string; label: string }[] = [];

    sorted.forEach((liq) => {
      cumulative += parseFloat(liq.liquidation_amount) / 1e9;
      const date = new Date(liq.checkpoint_timestamp_ms).toISOString().split('T')[0];
      const label = new Date(liq.checkpoint_timestamp_ms).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

      if (points.length > 0 && points[points.length - 1].date === date) {
        points[points.length - 1].cumulative = cumulative;
      } else {
        points.push({ timestamp: liq.checkpoint_timestamp_ms, cumulative, date, label });
      }
    });
    return points;
  }, [liquidations]);

  if (chartData.length < 2) {
    return (
      <div className="py-12 text-center" style={{ color: NERID.textMuted }}>
        <p className="text-sm">Not enough data for cumulative chart</p>
      </div>
    );
  }

  const maxCumulative = chartData[chartData.length - 1].cumulative;

  return (
    <>
      {/* Total volume pill */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-md"
          style={{ background: NERID.primaryFaint, color: NERID.primary }}
        >
          {formatValue(maxCumulative)} total volume processed
        </span>
      </div>

      {/* Recharts area chart */}
      <div
        className="rounded-lg border p-3"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: NERID.gridLine }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -8, bottom: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NERID.primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={NERID.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={NERID.gridLine} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: NERID.textMuted, fontSize: 10, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: NERID.textMuted, fontSize: 10, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={42}
              tickFormatter={(v: number) => formatValue(v)}
            />
            <Tooltip
              content={<CumulativeTooltip />}
              cursor={{ stroke: NERID.primary, strokeOpacity: 0.15, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={NERID.primary}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 5, fill: NERID.primary, stroke: '#0d1a1f', strokeWidth: 2 }}
              {...animationProps}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Subtitle */}
      <p className="mt-3 text-[11px]" style={{ color: NERID.textMuted }}>
        Total risk processed by the protocol over time
      </p>
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function BadDebtTimeline({ liquidations, isLoading }: BadDebtTimelineProps) {
  const [view, setView] = React.useState<ChartView>('activity');
  const dailyData = React.useMemo(() => groupByDay(liquidations), [liquidations]);

  if (isLoading) {
    return (
      <div className="surface-elevated p-6">
        <div className="h-[260px] rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.02)' }} />
      </div>
    );
  }

  if (liquidations.length === 0) {
    return (
      <div className="surface-elevated p-6">
        <h3 className="text-base font-semibold text-white mb-2">Liquidation Timeline</h3>
        <p className="text-sm" style={{ color: NERID.textMuted }}>No liquidation events to analyze</p>
      </div>
    );
  }

  return (
    <div className="surface-elevated p-6">
      {/* Header + toggle */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-white">Liquidation Timeline</h3>

        {/* Pill toggle */}
        <div className="tab-bar">
          <button
            onClick={() => setView('activity')}
            className={`tab-item ${view === 'activity' ? 'active' : ''}`}
          >
            Activity
          </button>
          <button
            onClick={() => setView('cumulative')}
            className={`tab-item ${view === 'cumulative' ? 'active' : ''}`}
          >
            Cumulative
          </button>
        </div>
      </div>

      {/* Chart content */}
      {view === 'activity' ? (
        <ActivityChart liquidations={liquidations} dailyData={dailyData} />
      ) : (
        <CumulativeChart liquidations={liquidations} />
      )}
    </div>
  );
}
