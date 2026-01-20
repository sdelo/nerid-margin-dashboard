import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { timeRangeToParams } from '../api/types';
import type { QueryParams, TimeRange } from '../api/types';
import {
  fetchLoanBorrowed,
  fetchLoanRepaid,
  fetchLiquidations,
  fetchAssetSupplied,
  fetchAssetWithdrawn,
} from '../api/events';
import {
  aggregateLoanEvents,
  aggregateSupplyWithdrawEvents,
  aggregateLiquidationStats,
  calculateUtilization,
  type TimeSeriesPoint,
  type SupplyBorrowPoint,
} from '../utils/eventTransform';

/**
 * Market insights data
 */
export interface MarketInsights {
  // Volume metrics
  totalBorrowVolume: number;
  totalSupplyVolume: number;
  netBorrowVolume: number;
  
  // Liquidation metrics
  liquidationCount: number;
  totalLiquidationValue: number;
  averageRiskRatio: number;
  
  // Utilization trends
  utilizationTrends: Array<{
    timestamp: number;
    utilization: number;
  }>;
  
  // Time series data
  borrowTimeSeries: TimeSeriesPoint[];
  supplyBorrowTimeSeries: SupplyBorrowPoint[];
}

/**
 * Hook to fetch and calculate market-wide insights
 */
export function useMarketInsights(
  poolId?: string,
  timeRange?: TimeRange
) {
  const params: QueryParams = {
    margin_pool_id: poolId,
    ...(timeRange ? timeRangeToParams(timeRange) : {}),
  };

  // Fetch all relevant events
  const borrowedQuery = useQuery({
    queryKey: ['loanBorrowed', 'insights', params],
    queryFn: () => fetchLoanBorrowed(params),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const repaidQuery = useQuery({
    queryKey: ['loanRepaid', 'insights', params],
    queryFn: () => fetchLoanRepaid(params),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const liquidationsQuery = useQuery({
    queryKey: ['liquidation', 'insights', params],
    queryFn: () => fetchLiquidations(params),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const suppliedQuery = useQuery({
    queryKey: ['assetSupplied', 'insights', params],
    queryFn: () => fetchAssetSupplied(params),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const withdrawnQuery = useQuery({
    queryKey: ['assetWithdrawn', 'insights', params],
    queryFn: () => fetchAssetWithdrawn(params),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const insights = React.useMemo((): MarketInsights | null => {
    if (
      !borrowedQuery.data ||
      !repaidQuery.data ||
      !liquidationsQuery.data ||
      !suppliedQuery.data ||
      !withdrawnQuery.data
    ) {
      return null;
    }

    // Determine decimals (default to 9 for SUI)
    const decimals = 9;

    // Calculate volumes
    const totalBorrowVolume = borrowedQuery.data.reduce(
      (sum, event) => sum + BigInt(event.loan_amount),
      0n
    );
    const totalRepayVolume = repaidQuery.data.reduce(
      (sum, event) => sum + BigInt(event.repay_amount),
      0n
    );
    const totalSupplyVolume = suppliedQuery.data.reduce(
      (sum, event) => sum + BigInt(event.amount),
      0n
    );
    const totalWithdrawVolume = withdrawnQuery.data.reduce(
      (sum, event) => sum + BigInt(event.amount),
      0n
    );

    // Aggregate time series
    const borrowTimeSeries = aggregateLoanEvents(
      borrowedQuery.data,
      repaidQuery.data,
      'day',
      decimals
    );

    const supplyBorrowTimeSeries = aggregateSupplyWithdrawEvents(
      suppliedQuery.data,
      withdrawnQuery.data,
      'day',
      decimals
    );

    // Calculate utilization trends from supply/borrow time series
    const utilizationTrends = supplyBorrowTimeSeries.map((point) => {
      // For now, we don't have borrow data in supply/withdraw events
      // This would need to be calculated from loan events
      // For now, return 0 or calculate from current pool state if available
      return {
        timestamp: point.timestamp,
        utilization: 0,
      };
    });

    // Aggregate liquidation stats
    const liquidationStats = aggregateLiquidationStats(
      liquidationsQuery.data,
      decimals
    );

    return {
      totalBorrowVolume: Number(totalBorrowVolume) / 10 ** decimals,
      totalSupplyVolume: Number(totalSupplyVolume - totalWithdrawVolume) / 10 ** decimals,
      netBorrowVolume: Number(totalBorrowVolume - totalRepayVolume) / 10 ** decimals,
      liquidationCount: liquidationStats.totalCount,
      totalLiquidationValue: liquidationStats.totalValue,
      averageRiskRatio: liquidationStats.averageRiskRatio,
      utilizationTrends,
      borrowTimeSeries,
      supplyBorrowTimeSeries,
    };
  }, [
    borrowedQuery.data,
    repaidQuery.data,
    liquidationsQuery.data,
    suppliedQuery.data,
    withdrawnQuery.data,
  ]);

  const isLoading =
    borrowedQuery.isLoading ||
    repaidQuery.isLoading ||
    liquidationsQuery.isLoading ||
    suppliedQuery.isLoading ||
    withdrawnQuery.isLoading;

  const error =
    borrowedQuery.error ||
    repaidQuery.error ||
    liquidationsQuery.error ||
    suppliedQuery.error ||
    withdrawnQuery.error;

  const refetch = React.useCallback(() => {
    borrowedQuery.refetch();
    repaidQuery.refetch();
    liquidationsQuery.refetch();
    suppliedQuery.refetch();
    withdrawnQuery.refetch();
  }, [
    borrowedQuery.refetch,
    repaidQuery.refetch,
    liquidationsQuery.refetch,
    suppliedQuery.refetch,
    withdrawnQuery.refetch,
  ]);

  return {
    insights,
    isLoading,
    error,
    refetch,
  };
}

