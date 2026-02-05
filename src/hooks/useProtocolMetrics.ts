import React from 'react';
import { useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { fetchMarginManagerCreated, fetchLiquidations } from '../features/lending/api/events';
import { getMarginPools, type NetworkType } from '../config/contracts';
import { fetchMarginPoolsBatched } from '../api/poolData';
import { useAppNetwork } from '../context/AppNetworkContext';

export interface ProtocolMetrics {
  totalValueLocked: number; // Total across all pools
  totalBorrowed: number; // Total across all pools
  totalSupply: number; // Total supplied by lenders
  activeMarginManagers: number; // Count of unique margin managers
  totalLiquidations: number; // Count of liquidation events
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch aggregated protocol-level metrics
 */
export function useProtocolMetrics(): ProtocolMetrics {
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const { serverUrl } = useAppNetwork();
  const [metrics, setMetrics] = React.useState<ProtocolMetrics>({
    totalValueLocked: 0,
    totalBorrowed: 0,
    totalSupply: 0,
    activeMarginManagers: 0,
    totalLiquidations: 0,
    isLoading: true,
    error: null,
  });

  const fetchMetrics = React.useCallback(async () => {
    try {
      const networkType = network as NetworkType;
      const poolConfigs = getMarginPools(networkType);
      const poolIds = poolConfigs.map(config => config.poolId);
      
      // Fetch all pool states in a single batched RPC call
      const pools = await fetchMarginPoolsBatched(suiClient, poolIds, networkType);

      // Calculate TVL (total supply across pools)
      const totalSupply = pools.reduce((sum, pool) => sum + (pool?.state.supply || 0), 0);
      const totalBorrowed = pools.reduce((sum, pool) => sum + (pool?.state.borrow || 0), 0);

      // Fetch unique margin managers (from margin_manager_created events)
      // Default time range (1 year) is automatically applied
      const marginManagers = await fetchMarginManagerCreated({ limit: 10000 });
      const uniqueManagerIds = new Set(marginManagers.map(m => m.margin_manager_id));

      // Fetch liquidation events to count total
      // Default time range (1 year) is automatically applied
      const liquidations = await fetchLiquidations({ limit: 10000 });

      setMetrics({
        totalValueLocked: totalSupply,
        totalBorrowed,
        totalSupply,
        activeMarginManagers: uniqueManagerIds.size,
        totalLiquidations: liquidations.length,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching protocol metrics:', error);
      setMetrics(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error,
      }));
    }
  }, [suiClient, serverUrl]);

  // Reset loading state and refetch when server URL changes
  React.useEffect(() => {
    setMetrics(prev => ({ ...prev, isLoading: true, error: null }));
    fetchMetrics();
  }, [fetchMetrics]);

  // Refresh every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return metrics;
}

