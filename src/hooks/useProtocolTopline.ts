import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketSummary, type MarketSummary } from '../features/lending/api/marketData';
import { fetchProtocolFeesIncreased } from '../features/lending/api/events';
import type { PoolOverview } from '../features/lending/types';

export interface ProtocolTopline {
  /** Total Value Locked in USD across all pools */
  tvlUsd: number;
  /** Total Borrowed in USD across all pools */
  borrowedUsd: number;
  /** Overall utilization percentage */
  utilization: number;
  /** 7-day net flow in USD */
  flow7dUsd: number;
  /** Total referral fees earned in USD (converted per-pool then summed) */
  totalReferralFeesUsd: number;
  /** Price map for debugging/display */
  prices: Map<string, number>;
  /** Loading state */
  isLoading: boolean;
}

/**
 * Get USD price for an asset using market data
 * For USDC/DBUSDC, price is always $1
 * For other assets, find the appropriate trading pair
 */
function getAssetPriceUsd(
  asset: string, 
  summaries: MarketSummary[]
): number {
  // Stablecoins are always $1
  if (asset === 'USDC' || asset === 'DBUSDC') {
    return 1.0;
  }
  
  // Look for trading pair with USDC as quote currency (direct USD price)
  const usdcPair = summaries.find(s => 
    s.base_currency === asset && s.quote_currency === 'USDC'
  );
  
  if (usdcPair && usdcPair.last_price > 0) {
    return usdcPair.last_price;
  }
  
  // Fallback: look for SUI pair and convert via SUI/USDC price
  const suiPair = summaries.find(s => 
    s.base_currency === asset && s.quote_currency === 'SUI'
  );
  
  const suiUsdcPair = summaries.find(s => 
    s.base_currency === 'SUI' && s.quote_currency === 'USDC'
  );
  
  if (suiPair && suiPair.last_price > 0 && suiUsdcPair && suiUsdcPair.last_price > 0) {
    // Convert: asset -> SUI -> USDC
    return suiPair.last_price * suiUsdcPair.last_price;
  }
  
  // Only warn if we have data but still can't find the price
  if (summaries.length > 0) {
    console.warn(`[useProtocolTopline] No price found for asset: ${asset}`);
  }
  return 0;
}

/**
 * Hook to compute protocol-wide topline metrics with proper USD conversion
 */
export function useProtocolTopline(
  pools: PoolOverview[],
  poolActivityMetrics: Map<string, { netFlow7d: number }>
): ProtocolTopline {
  // Fetch market summary for prices
  const pricesQuery = useQuery({
    queryKey: ['marketSummary'],
    queryFn: fetchMarketSummary,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  });

  // Fetch protocol fees across all pools for referral revenue
  // Don't filter by pool_id to get all pools
  const referralFeesQuery = useQuery({
    queryKey: ['protocolFeesIncreased', 'all'],
    queryFn: () => fetchProtocolFeesIncreased({ limit: 10000 }),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // 2 minutes
  });

  const result = React.useMemo((): ProtocolTopline => {
    const summaries = pricesQuery.data ?? [];
    const feeEvents = referralFeesQuery.data ?? [];
    const prices = new Map<string, number>();
    
    if (pools.length === 0) {
      return {
        tvlUsd: 0,
        borrowedUsd: 0,
        utilization: 0,
        flow7dUsd: 0,
        totalReferralFeesUsd: 0,
        prices,
        isLoading: pricesQuery.isLoading || referralFeesQuery.isLoading,
      };
    }

    // Build pool lookup by ID for referral fee conversion
    const poolById = new Map<string, PoolOverview>();
    for (const pool of pools) {
      poolById.set(pool.id, pool);
    }

    // Build price map for all pool assets
    for (const pool of pools) {
      if (!prices.has(pool.asset)) {
        const price = getAssetPriceUsd(pool.asset, summaries);
        prices.set(pool.asset, price);
      }
    }

    // Calculate USD-denominated TVL and borrowed
    let tvlUsd = 0;
    let borrowedUsd = 0;
    
    for (const pool of pools) {
      const supply = pool.state?.supply || 0;
      const borrow = pool.state?.borrow || 0;
      const price = prices.get(pool.asset) || 0;
      
      tvlUsd += supply * price;
      borrowedUsd += borrow * price;
    }

    const utilization = tvlUsd > 0 ? (borrowedUsd / tvlUsd) * 100 : 0;

    // Calculate 7d flow in USD
    let flow7dUsd = 0;
    for (const pool of pools) {
      const metric = poolActivityMetrics.get(pool.id);
      if (metric) {
        const price = prices.get(pool.asset) || 0;
        flow7dUsd += metric.netFlow7d * price;
      }
    }

    // Aggregate referral fees across all pools
    // Each pool's referral_fees is in that pool's native token (smallest units)
    // Convert each to USD before summing
    let totalReferralFeesUsd = 0;
    
    // Group fees by pool for conversion
    const feesByPool = new Map<string, bigint>();
    for (const event of feeEvents) {
      const poolId = event.margin_pool_id;
      const referralFees = BigInt(event.referral_fees || '0');
      const existing = feesByPool.get(poolId) || 0n;
      feesByPool.set(poolId, existing + referralFees);
    }
    
    // Convert each pool's fees to USD
    for (const [poolId, feesRaw] of feesByPool) {
      const pool = poolById.get(poolId);
      if (pool) {
        const decimals = pool.contracts?.coinDecimals ?? 9;
        const asset = pool.asset;
        const price = prices.get(asset) || 0;
        const feesInTokens = Number(feesRaw) / Math.pow(10, decimals);
        totalReferralFeesUsd += feesInTokens * price;
      }
    }

    return {
      tvlUsd,
      borrowedUsd,
      utilization,
      flow7dUsd,
      totalReferralFeesUsd,
      prices,
      isLoading: pricesQuery.isLoading || referralFeesQuery.isLoading,
    };
  }, [pools, poolActivityMetrics, pricesQuery.data, pricesQuery.isLoading, referralFeesQuery.data, referralFeesQuery.isLoading]);

  return result;
}
