import React from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { fetchMarginManagerCreated, fetchLoanBorrowed, fetchLoanRepaid, fetchLiquidations, type MarginManagersInfoResponse } from '../features/lending/api/events';
import { MarginManager } from '../contracts/deepbook_margin/deepbook_margin/margin_manager';
import { useAppNetwork } from '../context/AppNetworkContext';

export interface MarginManagerDetails {
  id: string;
  owner: string;
  deepbookPoolId: string;
  balanceManagerId: string;
  marginPoolId: string | null;
  borrowedBaseShares: string;
  borrowedQuoteShares: string;
  creationTimestamp: number;
  // Calculated fields
  totalBorrowed: number;
  riskRatio?: number;
}

export interface MarginManagerAnalytics {
  totalManagers: number;
  managersPerPool: Record<string, number>;
  recentManagers: MarginManagerDetails[]; // Last 24 hours
  managerDetails: Map<string, MarginManagerDetails>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and analyze margin manager data
 */
export function useMarginManagers(): MarginManagerAnalytics {
  const suiClient = useSuiClient();
  const { serverUrl } = useAppNetwork();
  const [analytics, setAnalytics] = React.useState<MarginManagerAnalytics>({
    totalManagers: 0,
    managersPerPool: {},
    recentManagers: [],
    managerDetails: new Map(),
    isLoading: true,
    error: null,
  });

  const fetchAnalytics = React.useCallback(async () => {
    try {
      // Fetch all margin manager created events
      // Default time range (1 year) is automatically applied
      const managerEvents = await fetchMarginManagerCreated({ limit: 10000 });
      
      const managersPerPool: Record<string, number> = {};
      const managerDetailsMap = new Map<string, MarginManagerDetails>();
      
      // Get 24 hours ago timestamp
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentManagers: MarginManagerDetails[] = [];

      // Process each manager event
      for (const event of managerEvents) {
        // Skip events with missing critical data
        if (!event.margin_manager_id || !event.sender || !event.checkpoint_timestamp_ms) {
          console.warn('Skipping margin manager event with missing data:', event);
          continue;
        }

        const detail: MarginManagerDetails = {
          id: event.margin_manager_id,
          owner: event.sender,
          deepbookPoolId: event.deepbook_pool_id || 'unknown',
          balanceManagerId: event.balance_manager_id || '', // Now available in API response
          marginPoolId: event.base_margin_pool_id || event.quote_margin_pool_id || null,
          borrowedBaseShares: '0',
          borrowedQuoteShares: '0',
          creationTimestamp: event.checkpoint_timestamp_ms,
          totalBorrowed: 0,
        };

        managerDetailsMap.set(event.margin_manager_id, detail);

        // Count managers per pool (only if pool ID exists)
        if (event.deepbook_pool_id) {
          const poolId = event.deepbook_pool_id;
          managersPerPool[poolId] = (managersPerPool[poolId] || 0) + 1;
        }

        // Add to recent if within 24 hours
        if (event.checkpoint_timestamp_ms >= oneDayAgo) {
          recentManagers.push(detail);
        }
      }

      // Try to fetch on-chain state for active managers (optional, may be expensive)
      // This would require querying each MarginManager object
      // For now, we'll rely on event data

      setAnalytics({
        totalManagers: managerEvents.length,
        managersPerPool,
        recentManagers: recentManagers.sort((a, b) => b.creationTimestamp - a.creationTimestamp),
        managerDetails: managerDetailsMap,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching margin manager analytics:', error);
      setAnalytics(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error,
      }));
    }
  }, [suiClient, serverUrl]);

  // Reset loading state and refetch when server URL changes
  React.useEffect(() => {
    setAnalytics(prev => ({ ...prev, isLoading: true, error: null }));
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Refresh every 60 seconds
  React.useEffect(() => {
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  return analytics;
}

/**
 * Hook to fetch detailed on-chain state for a specific margin manager
 */
export function useMarginManagerState(managerId: string | null) {
  const suiClient = useSuiClient();
  const [state, setState] = React.useState<{
    manager: typeof MarginManager['$inferInput'] | null;
    isLoading: boolean;
    error: Error | null;
  }>({
    manager: null,
    isLoading: true,
    error: null,
  });

  React.useEffect(() => {
    if (!managerId) {
      setState({ manager: null, isLoading: false, error: null });
      return;
    }

    async function fetchState() {
      try {
        const response = await suiClient.getObject({
          id: managerId!,
          options: {
            showBcs: true,
            showType: true,
          },
        });

        if (!response.data || !response.data.bcs || response.data.bcs.dataType !== 'moveObject') {
          throw new Error('Invalid margin manager object');
        }

        const manager = MarginManager.fromBase64(response.data.bcs.bcsBytes);
        setState({ manager, isLoading: false, error: null });
      } catch (error) {
        console.error('Error fetching margin manager state:', error);
        setState({ manager: null, isLoading: false, error: error as Error });
      }
    }

    fetchState();
  }, [managerId, suiClient]);

  return state;
}

