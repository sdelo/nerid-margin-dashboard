import React from 'react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMarginPoolsBatched } from '../api/poolData';
import { fetchUserPositions } from '../api/userPositions';
import { getMarginPools, type NetworkType } from '../config/contracts';
import type { PoolOverview, UserPosition } from '../features/lending/types';

export type AllPoolsResult = {
  pools: PoolOverview[];
  userPositions: UserPosition[];
  error: Error | null;
  isLoading: boolean;
  isLoadingPositions: boolean;
  refetch: () => void;
};

// Module-level cache for coin metadata (rarely changes, no need to re-fetch)
const coinMetadataCache = new Map<string, { iconUrl: string | null; fetchedAt: number }>();
const METADATA_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Hook that fetches all margin pools configured for the current network.
 *
 * Uses React Query under the hood so that:
 *  - Multiple callers (PoolsPage, DashboardNav, etc.) share a single in-flight request
 *  - React 18 strict mode double-mounts don't cause duplicate RPCs
 *  - Data is cached for `staleTime` and silently refreshed in the background
 */
export function useAllPools(userAddress?: string): AllPoolsResult {
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const queryClient = useQueryClient();
  const networkType = network as NetworkType;

  // ── Pool data query (shared across ALL callers) ──────────────────────
  const {
    data: pools = [],
    isLoading: isLoadingPools,
    error: poolsError,
  } = useQuery<PoolOverview[]>({
    queryKey: ['allPools', network],
    queryFn: async () => {
      const poolConfigs = getMarginPools(networkType);
      const poolIds = poolConfigs.map(config => config.poolId);

      // Only fetch coin metadata for types not already cached
      const now = Date.now();
      const uncachedConfigs = poolConfigs.filter(config => {
        const cached = coinMetadataCache.get(config.poolType);
        return !cached || (now - cached.fetchedAt > METADATA_CACHE_TTL_MS);
      });

      const metadataPromises = uncachedConfigs.map(config =>
        suiClient.getCoinMetadata({ coinType: config.poolType })
          .then(meta => ({ coinType: config.poolType, iconUrl: meta?.iconUrl || null }))
          .catch(() => ({ coinType: config.poolType, iconUrl: null }))
      );

      const _t0 = performance.now();
      const [poolResults, ...metadataResults] = await Promise.all([
        fetchMarginPoolsBatched(suiClient, poolIds, networkType),
        ...metadataPromises,
      ]);
      console.log(`⏱ [useAllPools] pools + metadata fetch: ${(performance.now() - _t0).toFixed(1)}ms`);

      // Update cache with freshly fetched metadata
      for (const meta of metadataResults) {
        coinMetadataCache.set(meta.coinType, { iconUrl: meta.iconUrl, fetchedAt: now });
      }

      // Combine pool data with coin metadata (iconUrl) from cache
      return (poolResults as (PoolOverview | null)[])
        .map((pool, index) => {
          if (!pool) return null;
          const cached = coinMetadataCache.get(poolConfigs[index].poolType);
          return {
            ...pool,
            ui: {
              ...pool.ui,
              iconUrl: cached?.iconUrl || null,
            },
          };
        })
        .filter((p): p is PoolOverview => p !== null);
    },
    staleTime: 15_000,          // Consider fresh for 15 seconds
    refetchInterval: 30_000,    // Silent background refresh every 30s
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // ── User positions query (only runs when wallet connected + pools ready) ──
  const {
    data: userPositions = [],
    isLoading: isLoadingPositions,
  } = useQuery<UserPosition[]>({
    queryKey: ['userPositions', network, userAddress],
    queryFn: async () => {
      if (!userAddress) return [];
      return fetchUserPositions(suiClient, userAddress, networkType);
    },
    enabled: !!userAddress && pools.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // ── Refetch both queries ──────────────────────────────────────────────
  const refetch = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['allPools', network] });
    if (userAddress) {
      queryClient.invalidateQueries({ queryKey: ['userPositions', network, userAddress] });
    }
  }, [queryClient, network, userAddress]);

  return {
    pools,
    userPositions,
    error: poolsError as Error | null,
    isLoading: isLoadingPools,
    isLoadingPositions,
    refetch,
  };
}
