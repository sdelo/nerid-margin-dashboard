import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchOHLCV, fetchPairSummary, parseCandles, type MarketSummary, type ParsedCandle } from '../api/marketData';
import { useChartFirstRender, useStableGradientId } from '../../../components/charts/StableChart';

interface MarketStatsProps {
  poolName?: string; // e.g., "SUI_DBUSDC"
  compact?: boolean;
}

export function MarketStats({ poolName = 'SUI_DBUSDC', compact = false }: MarketStatsProps) {
  // Fetch OHLCV data (hourly candles, last 48 hours)
  const { data: candles, isLoading: candlesLoading } = useQuery({
    queryKey: ['ohlcv', poolName],
    queryFn: () => fetchOHLCV(poolName, { interval: '1h', limit: 48 }),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Fetch market summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['marketSummary', poolName],
    queryFn: () => fetchPairSummary(poolName),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000,
  });

  // Parse candles for chart
  const chartData: ParsedCandle[] = React.useMemo(() => {
    if (!candles || candles.length === 0) return [];
    return parseCandles(candles).sort((a, b) => a.timestamp - b.timestamp);
  }, [candles]);

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(chartData.length > 0);
  const gradientUpId = useStableGradientId('priceGradientUp');
  const gradientDownId = useStableGradientId('priceGradientDown');

  // Only show loading on first load, not on refetches
  const isLoading = (candlesLoading || summaryLoading) && chartData.length === 0 && !summary;

  // Calculate price change color
  const priceChangeColor = summary?.price_change_percent_24h 
    ? summary.price_change_percent_24h >= 0 ? 'text-emerald-400' : 'text-red-400'
    : 'text-slate-400';

  const priceChangeSign = summary?.price_change_percent_24h 
    ? summary.price_change_percent_24h >= 0 ? '+' : ''
    : '';

  // Min/max for chart scaling - add padding to show variation clearly
  const chartPrices = chartData.length > 0 ? chartData.map(c => c.close) : [];
  const minClose = chartPrices.length > 0 ? Math.min(...chartPrices) : 0;
  const maxClose = chartPrices.length > 0 ? Math.max(...chartPrices) : 0;
  const priceRange = maxClose - minClose;
  // Add 20% padding on each side, or if range is tiny, create artificial range
  const padding = priceRange > 0 ? priceRange * 0.2 : minClose * 0.02;
  const minPrice = minClose - padding;
  const maxPrice = maxClose + padding;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-300">Market Stats</div>
        </div>
        <div className="h-24 bg-slate-700/30 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-slate-700/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Check if data is truly empty or just zeros
  const hasNoData = !summary || (summary.quote_volume === 0 && summary.last_price === 0);
  const hasNoTrades = summary && summary.quote_volume === 0 && summary.last_price > 0;

  if (!summary) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-300">Market Stats</div>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-slate-500">
          <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div className="text-xs font-medium">Market data unavailable</div>
          <div className="text-[10px] mt-1 opacity-60">Unable to fetch trading data</div>
        </div>
      </div>
    );
  }

  if (hasNoData) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-300">Market Stats</div>
          <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400">
            {poolName.replace('_', '/')}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-slate-500">
          <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs font-medium">No trading activity yet</div>
          <div className="text-[10px] mt-1 opacity-60">Chart will appear when trades occur</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with current price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Market Stats</span>
          <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400">
            {poolName.replace('_', '/')}
          </span>
        </div>
      </div>

      {/* Price and Change */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-white tabular-nums">
          {summary.last_price.toFixed(4)}
        </span>
        <span className={`text-sm font-medium ${priceChangeColor}`}>
          {priceChangeSign}{summary.price_change_percent_24h.toFixed(2)}%
        </span>
      </div>

      {/* Mini Chart */}
      {chartData.length > 1 && (
        <div className="h-16 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={gradientUpId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={gradientDownId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <YAxis domain={[minPrice, maxPrice]} hide />
              <XAxis dataKey="timestamp" hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                labelFormatter={(ts) => new Date(ts).toLocaleString()}
                formatter={(value: number) => [value.toFixed(4), 'Price']}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={summary.price_change_percent_24h >= 0 ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fill={summary.price_change_percent_24h >= 0 ? `url(#${gradientUpId})` : `url(#${gradientDownId})`}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                {...animationProps}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats - Inline for compact, grid for full */}
      {compact ? (
        <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
          <span>Range: <span className="text-slate-300">{summary.lowest_price_24h.toFixed(2)}-{summary.highest_price_24h.toFixed(2)}</span></span>
          <span>Vol: <span className="text-slate-300">{summary.quote_volume >= 1000 ? `${(summary.quote_volume / 1000).toFixed(1)}K` : summary.quote_volume.toFixed(0)}</span></span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-700/30 rounded-lg p-2">
            <div className="text-slate-500 mb-0.5">24h Range</div>
            <div className="text-slate-200 font-medium tabular-nums">
              {summary.lowest_price_24h.toFixed(2)} - {summary.highest_price_24h.toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2">
            <div className="text-slate-500 mb-0.5">Spread</div>
            <div className="text-slate-200 font-medium tabular-nums">
              {((summary.lowest_ask - summary.highest_bid) / summary.last_price * 100).toFixed(2)}%
            </div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2">
            <div className="text-slate-500 mb-0.5">Volume</div>
            <div className="text-slate-200 font-medium tabular-nums">
              {summary.quote_volume >= 1000 
                ? `${(summary.quote_volume / 1000).toFixed(1)}K`
                : summary.quote_volume.toFixed(2)
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketStats;
