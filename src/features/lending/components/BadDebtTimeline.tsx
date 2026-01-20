import React from 'react';
import { type LiquidationEventResponse } from '../api/events';

interface BadDebtTimelineProps {
  liquidations: LiquidationEventResponse[];
  isLoading: boolean;
}

interface DayData {
  date: string;
  timestamp: number;
  liquidationCount: number;
  badDebt: number;
  rewards: number;
}

/**
 * Group liquidations by day
 */
function groupByDay(liquidations: LiquidationEventResponse[]): DayData[] {
  const dayMap = new Map<string, { count: number; badDebt: number; rewards: number; timestamp: number }>();

  liquidations.forEach((liq) => {
    const date = new Date(liq.checkpoint_timestamp_ms);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

    const existing = dayMap.get(dateKey) || { count: 0, badDebt: 0, rewards: 0, timestamp: date.getTime() };
    existing.count += 1;
    existing.badDebt += parseFloat(liq.pool_default) / 1e9;
    existing.rewards += parseFloat(liq.pool_reward) / 1e9;
    dayMap.set(dateKey, existing);
  });

  // Convert to array and sort by date
  return Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      timestamp: data.timestamp,
      liquidationCount: data.count,
      badDebt: data.badDebt,
      rewards: data.rewards,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Format number with units
 */
function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (value >= 1) return value.toFixed(1);
  if (value > 0) return value.toFixed(2);
  return '0';
}

/**
 * Bad Debt + Rewards Timeline
 * Answers: "Was bad debt a one-off spike or recurring?"
 */
export function BadDebtTimeline({ liquidations, isLoading }: BadDebtTimelineProps) {
  const dailyData = React.useMemo(() => groupByDay(liquidations), [liquidations]);

  // Calculate stats
  const stats = React.useMemo(() => {
    if (dailyData.length === 0) {
      return { worstDay: null, medianBadDebt: 0, totalBadDebtDays: 0 };
    }

    const badDebtDays = dailyData.filter((d) => d.badDebt > 0);
    const worstDay = badDebtDays.reduce(
      (worst, day) => (day.badDebt > (worst?.badDebt || 0) ? day : worst),
      null as DayData | null
    );

    // Median of all days (including zeros)
    const sortedBadDebt = [...dailyData.map((d) => d.badDebt)].sort((a, b) => a - b);
    const medianBadDebt = sortedBadDebt[Math.floor(sortedBadDebt.length / 2)] || 0;

    return {
      worstDay,
      medianBadDebt,
      totalBadDebtDays: badDebtDays.length,
    };
  }, [dailyData]);

  // Chart dimensions
  const chartHeight = 120;
  const paddingLeft = 35;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 25;
  const innerWidth = 600 - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // Take last 30 data points max for readability
  const displayData = dailyData.slice(-30);

  // Scales
  const maxCount = Math.max(...displayData.map((d) => d.liquidationCount), 1);
  const maxBadDebt = Math.max(...displayData.map((d) => d.badDebt), 0.01);
  const barWidth = displayData.length > 0 ? (innerWidth / displayData.length) * 0.7 : 20;
  const barGap = displayData.length > 0 ? (innerWidth / displayData.length) * 0.3 : 5;

  const xScale = (idx: number) => paddingLeft + idx * (barWidth + barGap) + barWidth / 2;
  const yScaleCount = (count: number) => paddingTop + innerHeight - (count / maxCount) * innerHeight;
  const yScaleBadDebt = (debt: number) => paddingTop + innerHeight - (debt / maxBadDebt) * innerHeight;

  // Generate bad debt line path
  const linePath = displayData
    .map((d, idx) => {
      const x = xScale(idx);
      const y = yScaleBadDebt(d.badDebt);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  if (isLoading) {
    return (
      <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-5">
        <div className="h-[180px] bg-white/[0.03] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (liquidations.length === 0) {
    return (
      <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-5">
        <h3 className="text-base font-semibold text-white mb-2">Bad Debt Timeline</h3>
        <p className="text-sm text-white/40">No liquidation events to analyze</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 rounded-xl border border-white/[0.06] p-5">
      {/* Header with stats */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Liquidation Activity
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            Daily liquidations + bad debt trend — proof of system stability
          </p>
        </div>

        {/* Key stats */}
        <div className="flex items-center gap-4 text-xs">
          {stats.worstDay ? (
            <div className="text-right">
              <div className="text-rose-400 font-semibold">
                Worst: {formatValue(stats.worstDay.badDebt)}
              </div>
              <div className="text-white/30">{formatDate(stats.worstDay.date)}</div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-emerald-400 font-semibold">No bad debt</div>
              <div className="text-white/30">across all days</div>
            </div>
          )}
          <div className="w-px h-8 bg-white/10" />
          <div className="text-right">
            <div className="text-white/60 font-semibold">
              Median: {formatValue(stats.medianBadDebt)}
            </div>
            <div className="text-white/30">per day</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg viewBox={`0 0 600 ${chartHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => (
            <line
              key={ratio}
              x1={paddingLeft}
              y1={paddingTop + innerHeight * (1 - ratio)}
              x2={paddingLeft + innerWidth}
              y2={paddingTop + innerHeight * (1 - ratio)}
              stroke="white"
              strokeOpacity="0.05"
            />
          ))}

          {/* Bars - Liquidation count */}
          {displayData.map((day, idx) => {
            const x = xScale(idx) - barWidth / 2;
            const barHeight = (day.liquidationCount / maxCount) * innerHeight;
            const y = paddingTop + innerHeight - barHeight;
            const hasBadDebt = day.badDebt > 0;

            return (
              <g key={day.date}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 2)}
                  rx={2}
                  fill={hasBadDebt ? '#f43f5e' : '#14b8a6'}
                  fillOpacity={hasBadDebt ? 0.6 : 0.4}
                />
                {/* Hover indicator - only show count for bars with activity */}
                {day.liquidationCount > 0 && barHeight > 15 && (
                  <text
                    x={xScale(idx)}
                    y={y + 12}
                    textAnchor="middle"
                    className="fill-white text-[8px] font-medium"
                  >
                    {day.liquidationCount}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bad debt line (if any bad debt exists) */}
          {stats.totalBadDebtDays > 0 && (
            <>
              <path
                d={linePath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points for bad debt days */}
              {displayData
                .filter((d) => d.badDebt > 0)
                .map((day, idx) => {
                  const originalIdx = displayData.indexOf(day);
                  return (
                    <circle
                      key={day.date}
                      cx={xScale(originalIdx)}
                      cy={yScaleBadDebt(day.badDebt)}
                      r={4}
                      fill="#f43f5e"
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  );
                })}
            </>
          )}

          {/* Y-axis labels (left - count) */}
          <text
            x={paddingLeft - 5}
            y={paddingTop}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-white/30 text-[8px]"
          >
            {maxCount}
          </text>
          <text
            x={paddingLeft - 5}
            y={paddingTop + innerHeight}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-white/30 text-[8px]"
          >
            0
          </text>

          {/* X-axis labels (sparse - every 5th day or so) */}
          {displayData
            .filter((_, idx) => idx % Math.ceil(displayData.length / 6) === 0 || idx === displayData.length - 1)
            .map((day) => {
              const idx = displayData.indexOf(day);
              return (
                <text
                  key={day.date}
                  x={xScale(idx)}
                  y={paddingTop + innerHeight + 15}
                  textAnchor="middle"
                  className="fill-white/30 text-[8px]"
                >
                  {formatDate(day.date)}
                </text>
              );
            })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="w-3 h-2 rounded-sm bg-teal-500/60" />
          <span className="text-white/40">Healthy liquidations</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="w-3 h-2 rounded-sm bg-rose-500/60" />
          <span className="text-white/40">Days with bad debt</span>
        </div>
        {stats.totalBadDebtDays > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-0.5 bg-rose-500 rounded" />
            <span className="text-white/40">Bad debt trend</span>
          </div>
        )}
      </div>

      {/* Stability verdict */}
      <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
        {stats.totalBadDebtDays === 0 ? (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-white/70">
              <span className="font-semibold text-emerald-400">Zero bad debt</span> — All {liquidations.length} liquidations
              were fully collateralized. Protocol stability is strong.
            </span>
          </div>
        ) : stats.totalBadDebtDays === 1 ? (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs text-white/70">
              <span className="font-semibold text-amber-400">Single bad debt event</span> — Isolated incident on{' '}
              {stats.worstDay && formatDate(stats.worstDay.date)}. Not a recurring pattern.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs text-white/70">
              <span className="font-semibold text-rose-400">{stats.totalBadDebtDays} days with bad debt</span> — Review
              the timeline to understand if bad debt is concentrated or distributed.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
