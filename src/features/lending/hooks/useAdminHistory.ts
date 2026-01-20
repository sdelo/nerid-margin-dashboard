import { useQuery } from '@tanstack/react-query';
import type { QueryParams } from '../api/types';
import {
  fetchInterestParamsUpdated,
  fetchMarginPoolConfigUpdated,
  fetchDeepbookPoolUpdated,
  fetchMarginPoolCreated,
  type InterestParamsUpdatedEventResponse,
  type MarginPoolConfigUpdatedEventResponse,
  type DeepbookPoolUpdatedEventResponse,
  type MarginPoolCreatedEventResponse,
} from '../api/events';

export type AdminEvent = 
  | { type: 'interest_params'; data: InterestParamsUpdatedEventResponse }
  | { type: 'pool_config'; data: MarginPoolConfigUpdatedEventResponse }
  | { type: 'deepbook_pool'; data: DeepbookPoolUpdatedEventResponse }
  | { type: 'pool_created'; data: MarginPoolCreatedEventResponse };

/**
 * Hook to fetch all admin-related events for a pool
 */
export function useAdminHistory(poolId?: string) {
  const params: QueryParams = {
    margin_pool_id: poolId,
  };

  // Fetch all admin event types
  const interestParamsQuery = useQuery({
    queryKey: ['interestParamsUpdated', params],
    queryFn: () => fetchInterestParamsUpdated(params),
    enabled: !!poolId,
    staleTime: 60 * 1000, // 1 minute
  });

  const poolConfigQuery = useQuery({
    queryKey: ['marginPoolConfigUpdated', params],
    queryFn: () => fetchMarginPoolConfigUpdated(params),
    enabled: !!poolId,
    staleTime: 60 * 1000,
  });

  const deepbookPoolQuery = useQuery({
    queryKey: ['deepbookPoolUpdated', params],
    queryFn: () => fetchDeepbookPoolUpdated(params),
    enabled: !!poolId,
    staleTime: 60 * 1000,
  });

  const poolCreatedQuery = useQuery({
    queryKey: ['marginPoolCreated', params],
    queryFn: () => fetchMarginPoolCreated(params),
    enabled: !!poolId,
    staleTime: 60 * 1000,
  });

  // Combine and sort all events by timestamp
  const allEvents: AdminEvent[] = React.useMemo(() => {
    const events: AdminEvent[] = [];

    if (interestParamsQuery.data) {
      events.push(
        ...interestParamsQuery.data.map(e => ({ type: 'interest_params' as const, data: e }))
      );
    }

    if (poolConfigQuery.data) {
      events.push(
        ...poolConfigQuery.data.map(e => ({ type: 'pool_config' as const, data: e }))
      );
    }

    if (deepbookPoolQuery.data) {
      events.push(
        ...deepbookPoolQuery.data.map(e => ({ type: 'deepbook_pool' as const, data: e }))
      );
    }

    if (poolCreatedQuery.data) {
      events.push(
        ...poolCreatedQuery.data.map(e => ({ type: 'pool_created' as const, data: e }))
      );
    }

    // Sort by timestamp (most recent first) - use checkpoint_timestamp_ms from ApiEventMetadata
    return events.sort((a, b) => b.data.checkpoint_timestamp_ms - a.data.checkpoint_timestamp_ms);
  }, [
    interestParamsQuery.data,
    poolConfigQuery.data,
    deepbookPoolQuery.data,
    poolCreatedQuery.data,
  ]);

  const isLoading =
    interestParamsQuery.isLoading ||
    poolConfigQuery.isLoading ||
    deepbookPoolQuery.isLoading ||
    poolCreatedQuery.isLoading;

  const error =
    interestParamsQuery.error ||
    poolConfigQuery.error ||
    deepbookPoolQuery.error ||
    poolCreatedQuery.error;

  return {
    events: allEvents,
    isLoading,
    error,
    refetch: () => {
      interestParamsQuery.refetch();
      poolConfigQuery.refetch();
      deepbookPoolQuery.refetch();
      poolCreatedQuery.refetch();
    },
  };
}

// Need to import React for useMemo
import React from 'react';

