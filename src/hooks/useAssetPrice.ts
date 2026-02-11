import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketSummary, type MarketSummary } from '../features/lending/api/marketData';

/**
 * Get USD price for an asset using market data.
 * - Stablecoins (USDC/DBUSDC) → $1
 * - Others → look for ASSET/USDC pair, fall back to ASSET → SUI → USDC chain
 */
export function getAssetPriceUsd(asset: string, summaries: MarketSummary[]): number {
  if (asset === 'USDC' || asset === 'DBUSDC') return 1.0;

  // Direct ASSET/USDC pair
  const usdcPair = summaries.find(
    (s) => s.base_currency === asset && s.quote_currency === 'USDC',
  );
  if (usdcPair && usdcPair.last_price > 0) return usdcPair.last_price;

  // ASSET/DBUSDC pair
  const dbUsdcPair = summaries.find(
    (s) => s.base_currency === asset && s.quote_currency === 'DBUSDC',
  );
  if (dbUsdcPair && dbUsdcPair.last_price > 0) return dbUsdcPair.last_price;

  // ASSET → SUI → USDC chain
  const suiPair = summaries.find(
    (s) => s.base_currency === asset && s.quote_currency === 'SUI',
  );
  const suiUsdc = summaries.find(
    (s) => s.base_currency === 'SUI' && (s.quote_currency === 'USDC' || s.quote_currency === 'DBUSDC'),
  );
  if (suiPair?.last_price && suiUsdc?.last_price) {
    return suiPair.last_price * suiUsdc.last_price;
  }

  return 0;
}

export interface UseAssetPriceResult {
  /** USD price of the asset (0 if unavailable) */
  price: number;
  /** Whether the price data is still loading */
  isLoading: boolean;
  /** Convert a native amount to USD */
  toUsd: (amount: number) => number;
  /** Format a value in USD or native depending on mode */
  formatValue: (amount: number, nativeSymbol: string, mode: 'usd' | 'native') => string;
}

/**
 * Hook to get the current USD price for a single asset.
 * Re-fetches every 60s and shares the query cache across all instances.
 */
export function useAssetPrice(asset: string): UseAssetPriceResult {
  const { data: summaries, isLoading } = useQuery({
    queryKey: ['marketSummary'],
    queryFn: fetchMarketSummary,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const price = React.useMemo(
    () => (summaries ? getAssetPriceUsd(asset, summaries) : 0),
    [asset, summaries],
  );

  const toUsd = React.useCallback(
    (amount: number) => amount * price,
    [price],
  );

  const formatValue = React.useCallback(
    (amount: number, nativeSymbol: string, mode: 'usd' | 'native') => {
      if (mode === 'native') {
        return `${formatNum(amount)} ${nativeSymbol}`;
      }
      const usd = amount * price;
      return `$${formatNum(usd)}`;
    },
    [price],
  );

  return { price, isLoading, toUsd, formatValue };
}

/** Simple number formatter */
function formatNum(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export default useAssetPrice;
