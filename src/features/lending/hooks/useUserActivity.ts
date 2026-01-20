import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { timeRangeToParams } from '../api/types';
import type { QueryParams, TimeRange } from '../api/types';
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  type AssetSuppliedEventResponse,
  type AssetWithdrawnEventResponse,
} from '../api/events';
import { convertFromSmallestUnits } from '../utils/eventTransform';

/**
 * User transaction type
 */
export type UserTransactionType = 'supply' | 'withdraw';

/**
 * User transaction record
 */
export interface UserTransaction {
  id: string; // event_digest
  timestamp: number;
  type: UserTransactionType;
  poolId: string;
  assetType: string;
  amount: number;
  shares: number;
  transactionDigest: string;
  formattedAmount: string; // Human-readable amount with asset symbol
}

/**
 * Hook to fetch and format all user-related activity
 * 
 * Note: The indexer's `supplier` field contains the SupplierCap ID, not the wallet address.
 * We need to pass the supplierCapIds to filter correctly.
 */
export function useUserActivity(
  userAddress: string | undefined,
  poolId?: string,
  timeRange?: TimeRange,
  supplierCapIds?: string[]  // Added: array of SupplierCap IDs to filter by
) {
  // Build params - filter by supplier (SupplierCap ID) if provided
  // If supplierCapIds is provided, we'll filter client-side since API only accepts single supplier
  const params: QueryParams = {
    margin_pool_id: poolId,
    // Only filter by supplier if we have exactly one supplierCapId
    supplier: supplierCapIds?.length === 1 ? supplierCapIds[0] : undefined,
    ...(timeRange ? timeRangeToParams(timeRange) : {}),
  };

  const suppliedQuery = useQuery({
    queryKey: ['assetSupplied', 'user', params, supplierCapIds],
    queryFn: () => fetchAssetSupplied(params),
    enabled: !!userAddress && (supplierCapIds?.length ?? 0) > 0,
    staleTime: 5 * 1000,  // 5 seconds - shorter stale time for fresher data
    refetchInterval: 30 * 1000,  // Refetch every 30 seconds
  });

  const withdrawnQuery = useQuery({
    queryKey: ['assetWithdrawn', 'user', params, supplierCapIds],
    queryFn: () => fetchAssetWithdrawn(params),
    enabled: !!userAddress && (supplierCapIds?.length ?? 0) > 0,
    staleTime: 5 * 1000,  // 5 seconds - shorter stale time for fresher data
    refetchInterval: 30 * 1000,  // Refetch every 30 seconds
  });

  const transactions = React.useMemo(() => {
    if (!userAddress || !supplierCapIds || supplierCapIds.length === 0) return [];

    // Filter events by supplierCapId(s) - the `supplier` field in events contains the SupplierCap ID
    const filterBySupplierCap = (event: { supplier?: string }) => {
      if (!supplierCapIds || supplierCapIds.length === 0) return true;
      return supplierCapIds.includes(event.supplier || '');
    };

    const filteredSupplied = (suppliedQuery.data ?? []).filter(filterBySupplierCap);
    const filteredWithdrawn = (withdrawnQuery.data ?? []).filter(filterBySupplierCap);

    const supplied: UserTransaction[] = filteredSupplied.map((event) => {
      // Determine decimals based on asset type (9 for SUI, 6 for DBUSDC)
      const decimals = event.asset_type.includes('SUI') ? 9 : 6;
      const amount = convertFromSmallestUnits(event.amount, decimals);
      const assetSymbol = event.asset_type.includes('SUI') ? 'SUI' : 'DBUSDC';

      return {
        id: event.event_digest,
        timestamp: event.checkpoint_timestamp_ms,
        type: 'supply' as const,
        poolId: event.margin_pool_id,
        assetType: event.asset_type,
        amount,
        shares: Number(event.shares),
        transactionDigest: event.digest,
        formattedAmount: `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${assetSymbol}`,
      };
    });

    const withdrawn: UserTransaction[] = filteredWithdrawn.map((event) => {
      const decimals = event.asset_type.includes('SUI') ? 9 : 6;
      const amount = convertFromSmallestUnits(event.amount, decimals);
      const assetSymbol = event.asset_type.includes('SUI') ? 'SUI' : 'DBUSDC';

      return {
        id: event.event_digest,
        timestamp: event.checkpoint_timestamp_ms,
        type: 'withdraw' as const,
        poolId: event.margin_pool_id,
        assetType: event.asset_type,
        amount,
        shares: Number(event.shares),
        transactionDigest: event.digest,
        formattedAmount: `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${assetSymbol}`,
      };
    });

    // Combine and sort by timestamp (most recent first)
    const all = [...supplied, ...withdrawn].sort((a, b) => b.timestamp - a.timestamp);

    return all;
  }, [userAddress, supplierCapIds, suppliedQuery.data, withdrawnQuery.data]);

  return {
    transactions,
    isLoading: suppliedQuery.isLoading || withdrawnQuery.isLoading,
    error: suppliedQuery.error || withdrawnQuery.error,
    refetch: () => {
      suppliedQuery.refetch();
      withdrawnQuery.refetch();
    },
  };
}

