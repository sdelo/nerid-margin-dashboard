import React from 'react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { fetchMarginPool } from '../api/poolData';
import { fetchUserPositions } from '../api/userPositions';
import type { PoolOverview, UserPosition } from '../features/lending/types';
import type { NetworkType } from '../config/contracts';

export type PoolDataResult = {
  data: PoolOverview | null;
  userPosition: UserPosition | null;
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
};

export function usePoolData(poolId: string, userAddress?: string): PoolDataResult {
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const [data, setData] = React.useState<PoolOverview | null>(null);
  const [userPosition, setUserPosition] = React.useState<UserPosition | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchData = React.useCallback(async (isRefetch = false) => {
    if (!poolId) return;
    
    try {
      // Only set loading state on initial load, not on refetches
      if (!isRefetch) {
        setIsLoading(true);
      }
      setError(null);
      
      // Fetch pool data
      const poolResult = await fetchMarginPool(suiClient, poolId, network as NetworkType);
      setData(poolResult);
      
      // Fetch user position if user address is provided
      if (userAddress && poolResult) {
        // Instead of fetchUserPositionFromPool, use fetchUserPositions
        // and find the one matching this pool/asset
        const positions = await fetchUserPositions(suiClient, userAddress, network as NetworkType);
        const matchingPosition = positions.find(p => p.asset === poolResult.asset);
        setUserPosition(matchingPosition || null);
      } else {
        setUserPosition(null);
      }
    } catch (err) {
      console.error(`Error fetching pool data:`, err);
      setError(err as Error);
      // Only clear data on initial load errors, keep existing data on refetch errors
      if (!isRefetch) {
        setData(null);
        setUserPosition(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, poolId, userAddress, network]);

  // Initial fetch
  React.useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Set up automatic refetching every 15 seconds
  React.useEffect(() => {
    if (!poolId) return;
    
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
  }, [fetchData, poolId]);

  const refetch = React.useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return {
    data,
    userPosition,
    error,
    isLoading,
    refetch,
  };
}
