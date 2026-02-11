import React from 'react';
import { type AtRiskPosition, getPositionDirection } from '../../../hooks/useAtRiskPositions';
import { apiClient } from '../../../lib/api/client';

interface LiquidationHeatmapProps {
  positions: AtRiskPosition[];
  isLoading: boolean;
  /** Pre-selected asset filter from global coin selector */
  selectedCoins?: string[];
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(0)}`;
  return '$0';
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toFixed(0)}`;
  if (value >= 100) return `$${value.toFixed(1)}`;
  if (value >= 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(5)}`;
}

interface LiquidationBin {
  priceCenter: number;
  priceLow: number;
  priceHigh: number;
  longDebtAtRisk: number;
  shortDebtAtRisk: number;
  longCount: number;
  shortCount: number;
  positions: PositionLiqInfo[];
}

interface PositionLiqInfo {
  marginManagerId: string;
  direction: 'LONG' | 'SHORT';
  liquidationPrice: number;
  debtUsd: number;
  baseAssetSymbol: string;
  quoteAssetSymbol: string;
  distanceToLiquidation: number;
}

/**
 * Compute liquidation price for a position
 */
function computeLiquidationPrice(position: AtRiskPosition): number | null {
  const L = position.liquidationThreshold;
  const { baseAssetUsd, quoteAssetUsd, baseDebtUsd, quoteDebtUsd } = position;

  const denom = L * baseDebtUsd - baseAssetUsd;
  const numer = quoteAssetUsd - L * quoteDebtUsd;

  if (Math.abs(denom) < 0.001) return null;

  const k = numer / denom;
  if (k <= 0 || k > 100) return null;

  const currentBasePrice = position.basePythPrice / Math.pow(10, Math.abs(position.basePythDecimals));
  if (currentBasePrice <= 0) return null;

  return k * currentBasePrice;
}

/**
 * Build binned liquidation data for the heatmap
 */
function buildLiquidationBins(
  positions: AtRiskPosition[],
  numBins: number = 20
): { bins: LiquidationBin[]; currentPrice: number; maxDebt: number } {
  const liqInfos: PositionLiqInfo[] = [];

  positions.forEach(pos => {
    if (pos.totalDebtUsd < 0.01) return;
    const liqPrice = computeLiquidationPrice(pos);
    if (liqPrice === null) return;

    const { direction } = getPositionDirection(pos);
    liqInfos.push({
      marginManagerId: pos.marginManagerId,
      direction,
      liquidationPrice: liqPrice,
      debtUsd: pos.totalDebtUsd,
      baseAssetSymbol: pos.baseAssetSymbol,
      quoteAssetSymbol: pos.quoteAssetSymbol,
      distanceToLiquidation: pos.distanceToLiquidation,
    });
  });

  if (liqInfos.length === 0) {
    return { bins: [], currentPrice: 0, maxDebt: 0 };
  }

  const firstPos = positions.find(p => p.basePythPrice > 0);
  const currentPrice = firstPos
    ? firstPos.basePythPrice / Math.pow(10, Math.abs(firstPos.basePythDecimals))
    : 0;

  const priceLow = currentPrice * 0.6;
  const priceHigh = currentPrice * 1.4;
  const binWidth = (priceHigh - priceLow) / numBins;

  const bins: LiquidationBin[] = [];
  for (let i = 0; i < numBins; i++) {
    const low = priceLow + i * binWidth;
    const high = low + binWidth;
    bins.push({
      priceCenter: (low + high) / 2,
      priceLow: low,
      priceHigh: high,
      longDebtAtRisk: 0,
      shortDebtAtRisk: 0,
      longCount: 0,
      shortCount: 0,
      positions: [],
    });
  }

  liqInfos.forEach(info => {
    const binIndex = Math.floor((info.liquidationPrice - priceLow) / binWidth);
    if (binIndex >= 0 && binIndex < numBins) {
      const bin = bins[binIndex];
      bin.positions.push(info);
      if (info.direction === 'LONG') {
        bin.longDebtAtRisk += info.debtUsd;
        bin.longCount++;
      } else {
        bin.shortDebtAtRisk += info.debtUsd;
        bin.shortCount++;
      }
    }
  });

  const maxDebt = Math.max(...bins.map(b => b.longDebtAtRisk + b.shortDebtAtRisk), 1);

  return { bins, currentPrice, maxDebt };
}

/**
 * Map a base asset symbol to the DeepBook pool name for LOB data
 */
function assetToPoolName(asset: string): string {
  return `${asset}_USDC`;
}

/**
 * Liquidation Heatmap — Shows where liquidations cluster by price level
 * Supports any base asset dynamically (SUI, DEEP, WAL, etc.)
 */
export function LiquidationHeatmap({ positions, isLoading, selectedCoins }: LiquidationHeatmapProps) {
  const [hoveredBin, setHoveredBin] = React.useState<number | null>(null);
  const [selectedAsset, setSelectedAsset] = React.useState<string>('');
  const [showLob, setShowLob] = React.useState(true);
  const [lobData, setLobData] = React.useState<{ bids: [number, number][]; asks: [number, number][] } | null>(null);

  // Discover all unique base assets from positions
  const availableAssets = React.useMemo(() => {
    const assetSet = new Set<string>();
    positions.forEach(p => {
      if (p.baseAssetSymbol && p.totalDebtUsd > 0.01) {
        assetSet.add(p.baseAssetSymbol);
      }
    });
    return Array.from(assetSet).sort();
  }, [positions]);

  // If selectedCoins is provided, restrict available assets
  const effectiveAssets = React.useMemo(() => {
    if (selectedCoins && selectedCoins.length > 0) {
      return availableAssets.filter(a => selectedCoins.includes(a));
    }
    return availableAssets;
  }, [availableAssets, selectedCoins]);

  // Auto-select first available asset if current selection isn't valid
  React.useEffect(() => {
    if (effectiveAssets.length > 0 && !effectiveAssets.includes(selectedAsset)) {
      setSelectedAsset(effectiveAssets[0]);
    }
  }, [effectiveAssets, selectedAsset]);

  const filteredPositions = React.useMemo(() => {
    if (!selectedAsset) return [];
    return positions.filter(p => p.baseAssetSymbol === selectedAsset);
  }, [positions, selectedAsset]);

  const { bins, currentPrice, maxDebt } = React.useMemo(
    () => buildLiquidationBins(filteredPositions),
    [filteredPositions]
  );

  // Fetch LOB (orderbook) depth data
  React.useEffect(() => {
    if (!selectedAsset) return;

    async function fetchLob() {
      try {
        const poolName = assetToPoolName(selectedAsset);
        const data = await apiClient.get<{ bids: string[][]; asks: string[][] }>(
          `/orderbook/${poolName}?depth=200`
        );
        if (data?.bids && data?.asks) {
          setLobData({
            bids: data.bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])] as [number, number]),
            asks: data.asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])] as [number, number]),
          });
        } else {
          setLobData(null);
        }
      } catch (err) {
        console.warn(`Could not fetch LOB data for ${selectedAsset}:`, err);
        setLobData(null);
      }
    }
    fetchLob();
  }, [selectedAsset]);

  // Bin LOB data to match heatmap price bins, using log scaling
  const lobBinned = React.useMemo(() => {
    if (!lobData || bins.length === 0) return null;

    const bidsByBin: number[] = new Array(bins.length).fill(0);
    const asksByBin: number[] = new Array(bins.length).fill(0);

    lobData.bids.forEach(([price, qty]) => {
      const idx = bins.findIndex(b => price >= b.priceLow && price < b.priceHigh);
      if (idx >= 0) bidsByBin[idx] += qty * price;
    });

    lobData.asks.forEach(([price, qty]) => {
      const idx = bins.findIndex(b => price >= b.priceLow && price < b.priceHigh);
      if (idx >= 0) asksByBin[idx] += qty * price;
    });

    const allValues = [...bidsByBin, ...asksByBin].filter(v => v > 0);
    const maxLob = allValues.length > 0 ? Math.max(...allValues) : 1;

    return { bidsByBin, asksByBin, maxLob };
  }, [lobData, bins]);

  // Log scale helper for LOB depth (compresses extreme outliers)
  function logScale(value: number, max: number): number {
    if (value <= 0 || max <= 0) return 0;
    return (Math.log(1 + value) / Math.log(1 + max)) * 100;
  }

  // ─── Book Zone Annotations (thin/strong) ──────────────────────────────────
  const bookAnnotations = React.useMemo(() => {
    if (!lobBinned || bins.length === 0) return null;

    const annotations: Map<number, { label: string; color: string }> = new Map();
    const allDepths = bins.map((_, i) => (lobBinned.bidsByBin[i] || 0) + (lobBinned.asksByBin[i] || 0));
    const nonZero = allDepths.filter(d => d > 0);
    if (nonZero.length < 3) return null; // not enough data

    const avgDepth = nonZero.reduce((s, d) => s + d, 0) / nonZero.length;
    if (avgDepth <= 0) return null;

    allDepths.forEach((depth, idx) => {
      const isNearCurrent = currentPrice > 0 &&
        bins[idx].priceLow <= currentPrice * 1.05 &&
        bins[idx].priceHigh >= currentPrice * 0.95;

      if (depth > 0 && depth < avgDepth * 0.25 && !isNearCurrent) {
        annotations.set(idx, { label: 'Thin', color: 'text-rose-400/60' });
      } else if (depth > avgDepth * 3) {
        const isBid = (lobBinned.bidsByBin[idx] || 0) > (lobBinned.asksByBin[idx] || 0);
        annotations.set(idx, {
          label: isBid ? 'Strong support' : 'Strong resistance',
          color: isBid ? 'text-emerald-400/60' : 'text-rose-400/60',
        });
      }
    });

    return annotations.size > 0 ? annotations : null;
  }, [lobBinned, bins, currentPrice]);

  if (isLoading && positions.length === 0) {
    return (
      <div className="surface-elevated p-6">
        <div className="h-96 bg-white/[0.03] rounded-xl animate-pulse" />
      </div>
    );
  }

  const totalLiquidatable = bins.reduce((sum, b) => sum + b.positions.length, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-400">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
            Liquidation Map
          </h3>
          <p className="text-[10px] text-white/30 mt-1">
            {totalLiquidatable} positions with computable liquidation prices
            {selectedAsset && ` for ${selectedAsset}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* LOB overlay toggle */}
          <button
            onClick={() => setShowLob(!showLob)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
              showLob
                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                : 'bg-white/[0.03] text-white/40 border-white/[0.05] hover:text-white/60'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="14" width="3" height="6" rx="0.5" />
              <rect x="10" y="10" width="3" height="10" rx="0.5" />
              <rect x="16" y="6" width="3" height="14" rx="0.5" />
            </svg>
            Book Depth
          </button>

          {/* Asset selector — dynamic, shows all discovered assets */}
          {effectiveAssets.length > 0 && (
            <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.05]">
              {effectiveAssets.map(asset => (
                <button
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                    selectedAsset === asset
                      ? 'bg-teal-500/20 text-teal-400'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Current Price Header */}
      {currentPrice > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Current {selectedAsset} Price</span>
          <span className="text-sm font-bold text-white tabular-nums">{formatPrice(currentPrice)}</span>
        </div>
      )}

      {/* Heatmap */}
      {bins.length === 0 ? (
        <div className="surface-elevated p-12 text-center">
          <p className="text-white/40 text-sm">
            {selectedAsset
              ? `No positions with computable liquidation prices for ${selectedAsset}`
              : 'Select an asset to view the liquidation map'}
          </p>
          <p className="text-white/25 text-xs mt-2">Positions need both base and quote exposure for price-based liquidation</p>
        </div>
      ) : (
        <div className="surface-elevated p-4">
          {/* Column headers */}
          <div className="flex items-center gap-2 mb-2 text-[9px] text-white/25 uppercase tracking-wider">
            <div className="w-20 shrink-0 text-right pr-2">Price</div>
            <div className="flex-1">Liquidation Volume</div>
            {showLob && <div className="w-28 shrink-0 text-center">Book Depth</div>}
          </div>

          <div className="space-y-[2px]">
            {[...bins].reverse().map((bin, idx) => {
              const realIdx = bins.length - 1 - idx;
              const totalDebt = bin.longDebtAtRisk + bin.shortDebtAtRisk;
              const barWidthPct = maxDebt > 0 ? (totalDebt / maxDebt) * 100 : 0;
              const isCurrentPriceBin = currentPrice >= bin.priceLow && currentPrice < bin.priceHigh;
              const isAboveCurrent = bin.priceCenter > currentPrice;
              const isHovered = hoveredBin === realIdx;
              const longWidthPct = totalDebt > 0 ? (bin.longDebtAtRisk / totalDebt) * barWidthPct : 0;
              const shortWidthPct = totalDebt > 0 ? (bin.shortDebtAtRisk / totalDebt) * barWidthPct : 0;

              return (
                <div
                  key={realIdx}
                  className={`relative flex items-center gap-2 transition-all duration-150 rounded ${
                    isCurrentPriceBin ? 'bg-teal-400/[0.08] border border-teal-400/20' :
                    isHovered ? 'bg-white/[0.04]' : ''
                  }`}
                  onMouseEnter={() => setHoveredBin(realIdx)}
                  onMouseLeave={() => setHoveredBin(null)}
                >
                  {/* Price label */}
                  <div className={`w-20 shrink-0 text-right py-1 pr-2 ${
                    isCurrentPriceBin ? 'text-teal-400 font-bold' : 'text-white/30'
                  } text-[10px] tabular-nums`}>
                    {formatPrice(bin.priceCenter)}
                    {isCurrentPriceBin && (
                      <span className="ml-1 text-teal-400">◄</span>
                    )}
                  </div>

                  {/* Liquidation bar area */}
                  <div className="flex-1 h-6 relative">
                    <div className="absolute inset-0 bg-white/[0.02] rounded-sm" />

                    {/* Long bar */}
                    {bin.longDebtAtRisk > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                        style={{
                          width: `${Math.max(longWidthPct, 1)}%`,
                          background: isAboveCurrent
                            ? 'rgba(139, 92, 246, 0.35)'
                            : 'rgba(6, 182, 212, 0.35)',
                        }}
                      />
                    )}

                    {/* Short bar */}
                    {bin.shortDebtAtRisk > 0 && (
                      <div
                        className="absolute inset-y-0 rounded-sm transition-all duration-300"
                        style={{
                          left: `${longWidthPct}%`,
                          width: `${Math.max(shortWidthPct, 1)}%`,
                          background: isAboveCurrent
                            ? 'rgba(139, 92, 246, 0.35)'
                            : 'rgba(239, 68, 68, 0.25)',
                        }}
                      />
                    )}

                    {/* Label inside */}
                    {totalDebt > 0 && (
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[9px] font-medium text-white/60 tabular-nums">
                          {formatUsd(totalDebt)}
                          {(isHovered || isCurrentPriceBin) && (
                            <span className="text-white/30 ml-1">
                              · {bin.longCount + bin.shortCount} pos
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* LOB depth bar — log-scaled, separate bid/ask */}
                  {showLob && lobBinned && (
                    <div className="w-28 shrink-0 h-6 relative flex">
                      {(() => {
                        const bidVal = lobBinned.bidsByBin[realIdx] || 0;
                        const askVal = lobBinned.asksByBin[realIdx] || 0;
                        const bidPct = logScale(bidVal, lobBinned.maxLob);
                        const askPct = logScale(askVal, lobBinned.maxLob);
                        const totalLob = bidVal + askVal;
                        const annotation = bookAnnotations?.get(realIdx);

                        return (
                          <>
                            {/* Bid bar (right-aligned, grows left from center) */}
                            <div className="w-1/2 h-full relative">
                              <div className="absolute inset-0 bg-white/[0.015] rounded-l-sm" />
                              {bidVal > 0 && (
                                <div
                                  className="absolute inset-y-0 right-0 rounded-l-sm transition-all duration-300"
                                  style={{
                                    width: `${Math.max(bidPct, 3)}%`,
                                    background: 'rgba(16, 185, 129, 0.35)',
                                  }}
                                />
                              )}
                            </div>
                            {/* Center divider */}
                            <div className="w-px h-full bg-white/[0.08] shrink-0" />
                            {/* Ask bar (left-aligned, grows right from center) */}
                            <div className="w-1/2 h-full relative">
                              <div className="absolute inset-0 bg-white/[0.015] rounded-r-sm" />
                              {askVal > 0 && (
                                <div
                                  className="absolute inset-y-0 left-0 rounded-r-sm transition-all duration-300"
                                  style={{
                                    width: `${Math.max(askPct, 3)}%`,
                                    background: 'rgba(239, 68, 68, 0.30)',
                                  }}
                                />
                              )}
                            </div>
                            {/* Value label on hover OR book zone annotation */}
                            {totalLob > 0 && (isHovered || isCurrentPriceBin) ? (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[8px] font-medium text-white/50 tabular-nums bg-[#0d1a1f]/80 px-1 rounded">
                                  {formatUsd(totalLob)}
                                </span>
                              </div>
                            ) : annotation ? (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className={`text-[7px] font-semibold uppercase tracking-wider ${annotation.color}`}>
                                  {annotation.label}
                                </span>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Hover tooltip */}
                  {isHovered && totalDebt > 0 && (
                    <div className="absolute left-28 -top-1 z-20 bg-[#0d1a1f] border border-white/[0.1] rounded-lg shadow-xl p-3 min-w-[180px] pointer-events-none">
                      <div className="text-[10px] text-white/50 mb-1.5">
                        {formatPrice(bin.priceLow)} – {formatPrice(bin.priceHigh)}
                      </div>
                      {bin.longDebtAtRisk > 0 && (
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-cyan-400">Long liquidations</span>
                          <span className="font-bold text-white tabular-nums">{formatUsd(bin.longDebtAtRisk)}</span>
                        </div>
                      )}
                      {bin.shortDebtAtRisk > 0 && (
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-violet-400">Short liquidations</span>
                          <span className="font-bold text-white tabular-nums">{formatUsd(bin.shortDebtAtRisk)}</span>
                        </div>
                      )}
                      {showLob && lobBinned && (
                        <>
                          {(lobBinned.bidsByBin[realIdx] || 0) > 0 && (
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-emerald-400/70">Bid depth</span>
                              <span className="text-white/50 tabular-nums">{formatUsd(lobBinned.bidsByBin[realIdx])}</span>
                            </div>
                          )}
                          {(lobBinned.asksByBin[realIdx] || 0) > 0 && (
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-rose-400/70">Ask depth</span>
                              <span className="text-white/50 tabular-nums">{formatUsd(lobBinned.asksByBin[realIdx])}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="text-[9px] text-white/30 mt-1 pt-1 border-t border-white/[0.05]">
                        {bin.positions.length} position{bin.positions.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-white/[0.05] flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-cyan-500/40" />
              <span className="text-[10px] text-white/40">Long liquidations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-violet-500/40" />
              <span className="text-[10px] text-white/40">Short liquidations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border border-teal-400/30 bg-teal-400/10" />
              <span className="text-[10px] text-white/40">Current price</span>
            </div>
            {showLob && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500/35" />
                  <span className="text-[10px] text-white/40">Bids</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-rose-500/30" />
                  <span className="text-[10px] text-white/40">Asks</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Explainer */}
      <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
        <p className="text-[10px] text-white/25 leading-relaxed">
          Each row represents a price range. Bars show how much debt ($) would become liquidatable if the base asset reaches that price.
          Longs liquidate when price drops (below current), shorts when price rises (above current).
          {showLob && ' Book depth uses log scale — bids (left) / asks (right). "Thin" = low liquidity, "Strong support/resistance" = high liquidity.'}
          {' '}Hover for details.
        </p>
      </div>
    </div>
  );
}
