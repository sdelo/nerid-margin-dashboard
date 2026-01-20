import React from "react";
import type { PoolOverview } from "../types";
import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import { MarginPool } from "../../../contracts/deepbook_margin/deepbook_margin/margin_pool";
import { fetchLatestDeepbookPoolConfig } from "../api/events";
import { fetchOHLCV, fetchPairSummary, parseCandles, type MarketSummary, type ParsedCandle } from "../api/marketData";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

function formatRewardPercent(value: number): string {
  return ((value / 1_000_000_000) * 100).toFixed(1) + "%";
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

// Calculate volatility from candle data (average high-low range as % of close)
function calculateVolatility(candles: Array<[number, number, number, number, number, number]>): number {
  if (candles.length < 2) return 0;
  
  // Filter out invalid candles (where close is 0 or range is abnormal)
  const validRanges = candles
    .filter(([, , high, low, close]) => close > 0 && high > 0 && low > 0 && high >= low)
    .map(([, , high, low, close]) => {
      const range = ((high - low) / close) * 100;
      // Cap individual candle ranges at 20% to avoid outliers skewing the average
      return Math.min(range, 20);
    });
  
  if (validRanges.length === 0) return 0;
  
  return validRanges.reduce((sum, r) => sum + r, 0) / validRanges.length;
}

// Mini Market Chart component with Price/Volatility toggle
function MiniMarketChart({ 
  poolName, 
  priceUp, 
  mode = 'price' 
}: { 
  poolName: string; 
  priceUp: boolean;
  mode?: 'price' | 'volatility';
}) {
  const { data: candles, isLoading } = useQuery({
    queryKey: ['ohlcv-mini', poolName],
    queryFn: () => fetchOHLCV(poolName, { interval: '1h', limit: 24 }),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const chartData = React.useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const parsed = parseCandles(candles).sort((a, b) => a.timestamp - b.timestamp);
    
    if (mode === 'volatility') {
      // Calculate per-candle volatility (high-low range as % of close)
      return parsed.map(c => ({
        ...c,
        volatility: c.close > 0 ? ((c.high - c.low) / c.close) * 100 : 0,
      }));
    }
    return parsed;
  }, [candles, mode]);

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(chartData.length > 0);
  const priceGradientId = useStableGradientId(`mini-price-${poolName}`);
  const volGradientId = useStableGradientId(`mini-vol-${poolName}`);

  // Only show loading skeleton on first load, not on refetches
  if (isLoading && chartData.length === 0) {
    return (
      <div className="w-20 h-8 bg-white/10 rounded animate-pulse" />
    );
  }

  if (chartData.length < 2) {
    return (
      <div className="w-20 h-8 bg-white/10 rounded" />
    );
  }

  if (mode === 'volatility') {
    const volData = chartData.map((c: any) => c.volatility);
    const minVol = Math.min(...volData);
    const maxVol = Math.max(...volData);
    const volRange = maxVol - minVol;
    const padding = volRange > 0 ? volRange * 0.1 : 0.1;
    const avgVol = volData.reduce((a: number, b: number) => a + b, 0) / volData.length;
    const isElevated = volData[volData.length - 1] > avgVol;

    return (
      <div className="w-20 h-8">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id={volGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isElevated ? "#f59e0b" : "#6366f1"} stopOpacity={0.4} />
                <stop offset="100%" stopColor={isElevated ? "#f59e0b" : "#6366f1"} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <YAxis domain={[Math.max(0, minVol - padding), maxVol + padding]} hide />
            <Area
              type="monotone"
              dataKey="volatility"
              stroke={isElevated ? "#f59e0b" : "#6366f1"}
              strokeWidth={1.5}
              fill={`url(#${volGradientId})`}
              dot={false}
              {...animationProps}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const chartPrices = chartData.map(c => c.close);
  const minClose = Math.min(...chartPrices);
  const maxClose = Math.max(...chartPrices);
  const priceRange = maxClose - minClose;
  const padding = priceRange > 0 ? priceRange * 0.1 : minClose * 0.01;

  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={priceGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={priceUp ? "#10b981" : "#ef4444"} stopOpacity={0.4} />
              <stop offset="100%" stopColor={priceUp ? "#10b981" : "#ef4444"} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <YAxis domain={[minClose - padding, maxClose + padding]} hide />
          <Area
            type="monotone"
            dataKey="close"
            stroke={priceUp ? "#10b981" : "#ef4444"}
            strokeWidth={1.5}
            fill={`url(#${priceGradientId})`}
            dot={false}
            {...animationProps}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BackedMarketsTabProps {
  pool: PoolOverview;
  pools: PoolOverview[];
  onMarketClick?: (poolId: string) => void;
}

export function BackedMarketsTab({ pool, pools, onMarketClick }: BackedMarketsTabProps) {
  const suiClient = useSuiClient();
  const [deepbookPoolIds, setDeepbookPoolIds] = React.useState<string[]>([]);
  const [deepbookConfigs, setDeepbookConfigs] = React.useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [marketStats, setMarketStats] = React.useState<Record<string, MarketSummary | null>>({});
  const [sparklineMode, setSparklineMode] = React.useState<'price' | 'volatility'>('price');
  const [volatilityData, setVolatilityData] = React.useState<Record<string, { vol24h: number; vol7d: number }>>({});

  // Fetch allowed deepbook pools from margin pool
  React.useEffect(() => {
    async function fetchDeepbookPools() {
      if (!pool?.contracts?.marginPoolId) return;
      
      try {
        setIsLoading(true);
        const response = await suiClient.getObject({
          id: pool.contracts.marginPoolId,
          options: { showBcs: true },
        });

        if (
          response.data &&
          response.data.bcs &&
          response.data.bcs.dataType === "moveObject"
        ) {
          const marginPool = MarginPool.fromBase64(response.data.bcs.bcsBytes);
          const poolIds = marginPool.allowed_deepbook_pools.contents.map(
            (addr) => (typeof addr === "string" ? addr : `0x${addr}`)
          );
          setDeepbookPoolIds(poolIds);
        }
      } catch (error) {
        console.error("Error fetching deepbook pools:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDeepbookPools();
  }, [pool, suiClient]);

  // Fetch deepbook pool configs
  React.useEffect(() => {
    async function fetchConfigs() {
      if (deepbookPoolIds.length === 0) return;

      const configs: Record<string, any> = {};
      await Promise.all(
        deepbookPoolIds.map(async (poolId) => {
          try {
            const config = await fetchLatestDeepbookPoolConfig(poolId);
            configs[poolId] = config;
          } catch (error) {
            console.error(`Error fetching config for pool ${poolId}:`, error);
          }
        })
      );
      setDeepbookConfigs(configs);
    }

    fetchConfigs();
  }, [deepbookPoolIds]);

  // Build asset mapping
  const marginPoolIdToAsset = React.useMemo(() => {
    const mapping: Record<string, string> = {};
    pools.forEach((p) => {
      mapping[p.id] = p.asset;
      if (p.contracts?.marginPoolId) {
        mapping[p.contracts.marginPoolId] = p.asset;
      }
    });
    return mapping;
  }, [pools]);

  // Derive trading pairs from configs (filter out unknown ones)
  const tradingPairs = React.useMemo(() => {
    return deepbookPoolIds
      .map((poolId) => {
        const config = deepbookConfigs[poolId]?.config_json;
        const isEnabled = config?.enabled ?? false;
        
        // Calculate borrow share (simplified - equal distribution)
        const activeCount = deepbookPoolIds.filter(id => 
          deepbookConfigs[id]?.config_json?.enabled
        ).length;
        const borrowShare = isEnabled && activeCount > 0 
          ? Math.round(100 / activeCount) 
          : 0;

        if (config?.base_margin_pool_id && config?.quote_margin_pool_id) {
          const baseAsset = marginPoolIdToAsset[config.base_margin_pool_id];
          const quoteAsset = marginPoolIdToAsset[config.quote_margin_pool_id];
          
          // Skip if we can't resolve both assets
          if (!baseAsset || !quoteAsset) {
            return null;
          }
          
          return {
            poolId,
            display: `${baseAsset}/${quoteAsset}`,
            api: `${baseAsset}_${quoteAsset}`, // DeepBook API format: SUI_DBUSDC
            config,
            isEnabled,
            borrowShare,
          };
        }
        return null;
      })
      .filter((pair): pair is NonNullable<typeof pair> => pair !== null);
  }, [deepbookPoolIds, deepbookConfigs, marginPoolIdToAsset]);

  // Fetch market stats for each trading pair
  React.useEffect(() => {
    async function fetchMarketStats() {
      if (tradingPairs.length === 0) return;

      const stats: Record<string, MarketSummary | null> = {};
      await Promise.all(
        tradingPairs.map(async (pair) => {
          try {
            const summary = await fetchPairSummary(pair.api);
            stats[pair.poolId] = summary;
          } catch (error) {
            console.error(`Error fetching market stats for ${pair.api}:`, error);
            stats[pair.poolId] = null;
          }
        })
      );
      setMarketStats(stats);
    }

    fetchMarketStats();
  }, [tradingPairs]);

  // Fetch 24h and 7d candles for volatility comparison
  React.useEffect(() => {
    async function fetchVolatilityData() {
      if (tradingPairs.length === 0) return;

      const volData: Record<string, { vol24h: number; vol7d: number }> = {};
      await Promise.all(
        tradingPairs.map(async (pair) => {
          try {
            // Fetch 24h (hourly candles)
            const candles24h = await fetchOHLCV(pair.api, { interval: '1h', limit: 24 });
            // Fetch 7d (daily candles for 7 days)
            const candles7d = await fetchOHLCV(pair.api, { interval: '1d', limit: 7 });

            volData[pair.poolId] = {
              vol24h: calculateVolatility(candles24h),
              vol7d: calculateVolatility(candles7d),
            };
          } catch (error) {
            console.error(`Error fetching volatility for ${pair.api}:`, error);
            volData[pair.poolId] = { vol24h: 0, vol7d: 0 };
          }
        })
      );
      setVolatilityData(volData);
    }

    fetchVolatilityData();
  }, [tradingPairs]);

  // Summary stats
  const summaryStats = React.useMemo(() => {
    const activeMarkets = tradingPairs.filter(p => p.isEnabled);
    const pausedMarkets = tradingPairs.filter(p => !p.isEnabled);
    const topDriver = activeMarkets.length > 0 
      ? activeMarkets.reduce((max, p) => p.borrowShare > max.borrowShare ? p : max, activeMarkets[0])
      : null;
    
    return {
      topDriver,
      activeCount: activeMarkets.length,
      totalCount: tradingPairs.length,
      pausedCount: pausedMarkets.length,
    };
  }, [tradingPairs]);

  // Calculate volatility from actual candle data with 24h vs 7d comparison
  const getVolatilityInfo = (poolId: string): { 
    level: "low" | "med" | "high"; 
    vol24h: number;
    vol7d: number;
    trend: "rising" | "falling" | "stable";
    riskLabel: string;
  } => {
    const volData = volatilityData[poolId];
    if (!volData || (volData.vol24h === 0 && volData.vol7d === 0)) {
      return { level: "low", vol24h: 0, vol7d: 0, trend: "stable", riskLabel: "No data" };
    }

    const { vol24h, vol7d } = volData;
    
    // Determine volatility level based on 24h average range
    // < 1% = Low, 1-3% = Medium, > 3% = High
    let level: "low" | "med" | "high";
    if (vol24h < 1) level = "low";
    else if (vol24h < 3) level = "med";
    else level = "high";

    // Compare 24h to 7d to determine trend
    let trend: "rising" | "falling" | "stable";
    let riskLabel: string;
    
    if (vol7d === 0) {
      trend = "stable";
      riskLabel = level === "low" ? "Calm" : level === "med" ? "Normal" : "Volatile";
    } else {
      const ratio = vol24h / vol7d;
      if (ratio > 1.3) {
        trend = "rising";
        riskLabel = level === "high" ? "⚠️ Elevated" : "Rising";
      } else if (ratio < 0.7) {
        trend = "falling";
        riskLabel = "Calming";
      } else {
        trend = "stable";
        riskLabel = level === "low" ? "Calm" : level === "med" ? "Normal" : "Active";
      }
    }

    return { level, vol24h, vol7d, trend, riskLabel };
  };

  // Withdraw risk based on pool utilization
  const getWithdrawRisk = (): { level: "low" | "med" | "high"; label: string; utilization: number } => {
    const utilization = pool.state.supply > 0 
      ? (pool.state.borrow / pool.state.supply) * 100 
      : 0;
    if (utilization < 50) return { level: "low", label: "Low", utilization };
    if (utilization < 80) return { level: "med", label: "Med", utilization };
    return { level: "high", label: "High", utilization };
  };

  const withdrawRisk = getWithdrawRisk();

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 w-48 bg-white/10 rounded" />
        <div className="h-4 w-64 bg-white/5 rounded" />
        <div className="h-12 bg-white/5 rounded-lg" />
        <div className="h-14 bg-white/5 rounded-lg" />
      </div>
    );
  }

  if (deepbookPoolIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          className="w-10 h-10 text-white/30 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
        <h3 className="text-base font-medium text-white/70 mb-1">No Linked Markets</h3>
        <p className="text-xs text-white/40 max-w-sm">
          This pool is not connected to any trading markets yet.
        </p>
      </div>
    );
  }

  // Sparkline mode toggle component
  const sparklineModeControls = (
    <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1">
      <button
        onClick={() => setSparklineMode('price')}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          sparklineMode === 'price'
            ? 'bg-teal-500 text-white'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        Price
      </button>
      <button
        onClick={() => setSparklineMode('volatility')}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          sparklineMode === 'volatility'
            ? 'bg-amber-500 text-white'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        Volatility
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header - matches Activity tab style */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Backed Markets
          </h2>
          <p className="text-sm text-white/60">
            Trading pools that borrow from this margin pool for {pool.asset}
          </p>
        </div>
        {sparklineModeControls}
      </div>

      {/* Stats Cards - matches Activity tab style */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {summaryStats.topDriver && (
          <div className="bg-white/5 rounded-2xl p-4 border border-teal-500/30">
            <div className="text-sm text-white/60 mb-1">Top Driver</div>
            <div className="text-xl font-bold text-teal-400">{summaryStats.topDriver.display}</div>
            <div className="text-xs text-white/40 mt-1">{summaryStats.topDriver.borrowShare}% of borrows</div>
          </div>
        )}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Active Markets</div>
          <div className="text-xl font-bold text-emerald-400">{summaryStats.activeCount}</div>
          <div className="text-xs text-white/40 mt-1">of {summaryStats.totalCount} total</div>
        </div>
        {summaryStats.pausedCount > 0 && (
          <div className="bg-white/5 rounded-2xl p-4 border border-red-500/30">
            <div className="text-sm text-white/60 mb-1">Paused</div>
            <div className="text-xl font-bold text-red-400">{summaryStats.pausedCount}</div>
            <div className="text-xs text-white/40 mt-1">Not borrowing</div>
          </div>
        )}
      </div>

      {/* Market Cards with Charts */}
      <div className="space-y-3">
        {tradingPairs.map((pair) => {
          const volInfo = getVolatilityInfo(pair.poolId);
          const stats = marketStats[pair.poolId];
          const poolReward = pair.config?.pool_liquidation_reward 
            ? formatRewardPercent(pair.config.pool_liquidation_reward)
            : "—";
          const priceUp = (stats?.price_change_percent_24h ?? 0) >= 0;
          const priceChange = stats?.price_change_percent_24h ?? 0;
          const hasMarketData = stats && stats.last_price > 0;
          
          // Calculate spread if available
          const spread = stats && stats.lowest_ask > 0 && stats.highest_bid > 0 && stats.last_price > 0
            ? ((stats.lowest_ask - stats.highest_bid) / stats.last_price * 100).toFixed(3)
            : null;

          return (
            <button
              key={pair.poolId}
              onClick={() => onMarketClick?.(pair.poolId)}
              className="w-full group p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 hover:border-teal-500/40 transition-all cursor-pointer text-left"
            >
              {/* Top Row: Market info + Status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${pair.isEnabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-base font-semibold text-white">{pair.display}</span>
                  <span className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded">DeepBook</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    pair.isEnabled 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {pair.isEnabled ? 'Active' : 'Paused'}
                  </span>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-white/30 group-hover:text-cyan-400 transition-colors" />
              </div>

              {/* Main Content: Chart + Supplier Signal + Stats */}
              <div className="flex items-stretch gap-4">
                {/* Left: Sparkline Chart */}
                <div className="flex-shrink-0">
                  <MiniMarketChart 
                    poolName={pair.api} 
                    priceUp={priceUp} 
                    mode={sparklineMode}
                  />
                  <div className="text-[9px] text-white/30 text-center mt-0.5">
                    {sparklineMode === 'price' ? '24h price' : '24h vol'}
                  </div>
                </div>

                {/* Middle: Supplier Signal */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  {!pair.isEnabled ? (
                    /* PAUSED: Show status reason */
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                          <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-sm font-semibold text-red-400">Borrowing Disabled</span>
                      </div>
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        This market is paused. No new borrows are being placed against this pool.
                      </p>
                    </div>
                  ) : (
                    /* ACTIVE: Show risk heat / borrow demand signal */
                    <div className="space-y-2">
                      {/* Risk Heat Badge */}
                      <div className="flex items-center gap-2">
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                          volInfo.level === 'low' 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : volInfo.level === 'med'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            volInfo.level === 'low' ? 'bg-emerald-400' :
                            volInfo.level === 'med' ? 'bg-amber-400' : 'bg-red-400'
                          }`} />
                          {volInfo.riskLabel}
                        </div>
                        {/* Borrow share chip */}
                        <div className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-white/50">
                          {pair.borrowShare}% of borrows
                        </div>
                      </div>
                      
                      {/* Volatility context line */}
                      <p className="text-[11px] text-white/40">
                        {volInfo.vol7d > 0 && volInfo.vol7d < 100 ? (
                          volInfo.trend === 'rising' ? (
                            <>Above 7d avg <span className="text-amber-400">({volInfo.vol24h.toFixed(1)}% vs {volInfo.vol7d.toFixed(1)}%)</span></>
                          ) : volInfo.trend === 'falling' ? (
                            <>Below 7d avg <span className="text-emerald-400">({volInfo.vol24h.toFixed(1)}% vs {volInfo.vol7d.toFixed(1)}%)</span></>
                          ) : (
                            <>Near 7d avg <span className="text-white/50">({volInfo.vol24h.toFixed(1)}%)</span></>
                          )
                        ) : volInfo.vol24h > 0 ? (
                          <>24h volatility: <span className="text-white/70">{volInfo.vol24h.toFixed(1)}%</span></>
                        ) : (
                          'Volatility data loading...'
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: Compact Stats */}
                <div className="flex flex-col gap-1.5 text-[11px] min-w-[120px]">
                  {/* Volume (24h) */}
                  <div className="flex items-center justify-between">
                    <span className="text-white/40">Volume</span>
                    <span className="text-white/70 font-medium">
                      {hasMarketData ? formatVolume(stats.quote_volume) : '—'}
                    </span>
                  </div>
                  
                  {/* Volatility (24h) */}
                  <div className="flex items-center justify-between">
                    <span className="text-white/40">Volatility</span>
                    <span className={`font-medium ${
                      volInfo.level === 'low' ? 'text-emerald-400' : 
                      volInfo.level === 'med' ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {volInfo.vol24h > 0 ? `${volInfo.vol24h.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  
                  {/* Liq. Reward */}
                  <div className="flex items-center justify-between">
                    <span className="text-white/40">Liq. Reward</span>
                    <span className="text-cyan-400 font-medium">{poolReward}</span>
                  </div>
                  
                  {/* Spread */}
                  <div className="flex items-center justify-between">
                    <span className="text-white/40">Spread</span>
                    <span className="text-white/70 font-medium">
                      {spread ? `${spread}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom: Borrow Share Bar */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-white/40">Borrow share from this pool</span>
                  <span className="text-amber-400 font-semibold">{pair.borrowShare}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                    style={{ width: `${pair.borrowShare}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* What This Tells You */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Borrow Demand</span>
            <p className="mt-1">
              Shows which markets are actively borrowing from this pool. Higher borrow share means 
              more trading activity and typically higher yield for suppliers.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Volatility (24h vs 7d)</span>
            <p className="mt-1">
              The average price range per candle. We compare 24h to 7d: <span className="text-amber-400">↑ Rising</span> means 
              recent volatility is elevated vs normal, <span className="text-emerald-400">↓ Falling</span> means calmer than usual.
              Toggle the sparkline to visualize volatility patterns.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Liquidation Rewards</span>
            <p className="mt-1">
              When positions are liquidated, a portion goes to pool suppliers. Higher volatile markets 
              typically have more liquidations = more rewards for you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BackedMarketsTab;
