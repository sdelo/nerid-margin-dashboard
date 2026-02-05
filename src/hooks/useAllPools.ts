import React from 'react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { fetchMarginPoolsBatched } from '../api/poolData';
import { fetchUserPositions } from '../api/userPositions';
import { getMarginPools, type NetworkType } from '../config/contracts';
import type { PoolOverview, UserPosition } from '../features/lending/types';

// Auto-refresh interval in milliseconds
// Using 30s instead of 15s to reduce load on RPC endpoints
const AUTO_REFRESH_INTERVAL_MS = 30_000;

export type AllPoolsResult = {
  pools: PoolOverview[];
  userPositions: UserPosition[];
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
};

/**
 * Hook that fetches all margin pools configured for the current network
 */
export function useAllPools(userAddress?: string): AllPoolsResult {
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const [pools, setPools] = React.useState<PoolOverview[]>([]);
  const [userPositions, setUserPositions] = React.useState<UserPosition[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchData = React.useCallback(async (isRefetch = false) => {
    try {
      if (!isRefetch) {
        setIsLoading(true);
      }
      setError(null);
      
      const networkType = network as NetworkType;
      const poolConfigs = getMarginPools(networkType);
      const poolIds = poolConfigs.map(config => config.poolId);
      
      // Fetch all pools in a single batched RPC call + metadata in parallel
      const metadataPromises = poolConfigs.map(config =>
        suiClient.getCoinMetadata({ coinType: config.poolType }).catch(() => null)
      );
      
      const [poolResults, metadataResults] = await Promise.all([
        fetchMarginPoolsBatched(suiClient, poolIds, networkType),
        Promise.all(metadataPromises),
      ]);
      
      // Combine pool data with coin metadata (iconUrl)
      const validPools = poolResults
        .map((pool, index) => {
          if (!pool) return null;
          const metadata = metadataResults[index];
          return {
            ...pool,
            ui: {
              ...pool.ui,
              iconUrl: metadata?.iconUrl || null,
            },
          };
        })
        .filter((p): p is PoolOverview => p !== null);
      
      setPools(validPools);
      
      // Fetch user positions if user address is provided
      if (userAddress && validPools.length > 0) {
        const positions = await fetchUserPositions(suiClient, userAddress, networkType);
        setUserPositions(positions);
      } else {
        setUserPositions([]);
      }
    } catch (err) {
      console.error('Error fetching pools:', err);
      setError(err as Error);
      if (!isRefetch) {
        setPools([]);
        setUserPositions([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, network, userAddress]);

  // Initial fetch
  React.useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Auto-refresh periodically to keep data fresh
  React.useEffect(() => {
    const interval = setInterval(() => fetchData(true), AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const refetch = React.useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return {
    pools,
    userPositions,
    error,
    isLoading,
    refetch,
  };
}
