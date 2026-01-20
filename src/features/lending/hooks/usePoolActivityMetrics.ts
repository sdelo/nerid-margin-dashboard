import React from 'react';
import { 
  fetchAssetSupplied, 
  fetchAssetWithdrawn,
  fetchLoanBorrowed,
  fetchLoanRepaid,
} from '../api/events';
import type { PoolOverview } from '../types';

export interface PoolActivityMetrics {
  poolId: string;
  // Net deposits - withdrawals over period
  netFlow7d: number;
  // Total borrow volume (turnover)
  borrowVolume7d: number;
  // Unique active users
  activeSuppliers7d: number;
  activeBorrowers7d: number;
  // Last activity timestamps
  lastBorrowTime: number | null;
  lastRepayTime: number | null;
  lastSupplyTime: number | null;
  lastWithdrawTime: number | null;
}

export interface UsePoolActivityMetricsResult {
  metrics: Map<string, PoolActivityMetrics>;
  isLoading: boolean;
  error: Error | null;
}

function getTimeParams7d() {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  // API expects timestamps in SECONDS, not milliseconds
  return {
    start_time: Math.floor(sevenDaysAgo / 1000),
    end_time: Math.floor(now / 1000),
  };
}

export function usePoolActivityMetrics(pools: PoolOverview[]): UsePoolActivityMetricsResult {
  const [metrics, setMetrics] = React.useState<Map<string, PoolActivityMetrics>>(new Map());
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Create a stable key for pools array
  const poolIds = pools.map(p => p.contracts?.marginPoolId).filter(Boolean).join(',');

  React.useEffect(() => {
    if (!pools.length) {
      setIsLoading(false);
      return;
    }

    async function fetchMetrics() {
      try {
        setIsLoading(true);
        setError(null);

        const timeParams = getTimeParams7d();
        const newMetrics = new Map<string, PoolActivityMetrics>();

        // Initialize metrics for all pools
        for (const pool of pools) {
          const poolId = pool.contracts?.marginPoolId;
          if (!poolId) continue;

          newMetrics.set(poolId, {
            poolId,
            netFlow7d: 0,
            borrowVolume7d: 0,
            activeSuppliers7d: 0,
            activeBorrowers7d: 0,
            lastBorrowTime: null,
            lastRepayTime: null,
            lastSupplyTime: null,
            lastWithdrawTime: null,
          });
        }

        // Fetch all events in parallel (one request per event type, not per pool)
        const [supplied, withdrawn, borrowed, repaid] = await Promise.all([
          fetchAssetSupplied({ ...timeParams, limit: 10000 }),
          fetchAssetWithdrawn({ ...timeParams, limit: 10000 }),
          fetchLoanBorrowed({ ...timeParams, limit: 10000 }),
          fetchLoanRepaid({ ...timeParams, limit: 10000 }),
        ]);

        // Get pool decimals map
        const decimalsMap = new Map<string, number>();
        for (const pool of pools) {
          const poolId = pool.contracts?.marginPoolId;
          if (poolId) {
            decimalsMap.set(poolId, pool.contracts?.coinDecimals ?? 9);
          }
        }

        // Process supplied events
        for (const event of supplied) {
          const poolId = event.margin_pool_id;
          const metric = newMetrics.get(poolId);
          if (!metric) continue;

          const decimals = decimalsMap.get(poolId) ?? 9;
          const amount = parseFloat(event.amount) / (10 ** decimals);
          metric.netFlow7d += amount;
          
          // Track unique suppliers
          const timestamp = event.checkpoint_timestamp_ms;
          if (!metric.lastSupplyTime || timestamp > metric.lastSupplyTime) {
            metric.lastSupplyTime = timestamp;
          }
        }

        // Count unique suppliers
        const suppliersByPool = new Map<string, Set<string>>();
        for (const event of supplied) {
          const poolId = event.margin_pool_id;
          if (!suppliersByPool.has(poolId)) {
            suppliersByPool.set(poolId, new Set());
          }
          suppliersByPool.get(poolId)!.add(event.supplier);
        }

        // Process withdrawn events
        for (const event of withdrawn) {
          const poolId = event.margin_pool_id;
          const metric = newMetrics.get(poolId);
          if (!metric) continue;

          const decimals = decimalsMap.get(poolId) ?? 9;
          const amount = parseFloat(event.amount) / (10 ** decimals);
          metric.netFlow7d -= amount;

          const timestamp = event.checkpoint_timestamp_ms;
          if (!metric.lastWithdrawTime || timestamp > metric.lastWithdrawTime) {
            metric.lastWithdrawTime = timestamp;
          }

          // Also count withdrawers as active suppliers
          if (!suppliersByPool.has(poolId)) {
            suppliersByPool.set(poolId, new Set());
          }
          suppliersByPool.get(poolId)!.add(event.supplier);
        }

        // Process borrowed events
        const borrowersByPool = new Map<string, Set<string>>();
        for (const event of borrowed) {
          const poolId = event.margin_pool_id;
          const metric = newMetrics.get(poolId);
          if (!metric) continue;

          const decimals = decimalsMap.get(poolId) ?? 9;
          const amount = parseFloat(event.loan_amount) / (10 ** decimals);
          metric.borrowVolume7d += amount;

          const timestamp = event.checkpoint_timestamp_ms;
          if (!metric.lastBorrowTime || timestamp > metric.lastBorrowTime) {
            metric.lastBorrowTime = timestamp;
          }

          // Track unique borrowers via margin_manager_id
          if (!borrowersByPool.has(poolId)) {
            borrowersByPool.set(poolId, new Set());
          }
          borrowersByPool.get(poolId)!.add(event.margin_manager_id);
        }

        // Process repaid events (also counts as borrow activity)
        for (const event of repaid) {
          const poolId = event.margin_pool_id;
          const metric = newMetrics.get(poolId);
          if (!metric) continue;

          const timestamp = event.checkpoint_timestamp_ms;
          if (!metric.lastRepayTime || timestamp > metric.lastRepayTime) {
            metric.lastRepayTime = timestamp;
          }

          // Track unique borrowers
          if (!borrowersByPool.has(poolId)) {
            borrowersByPool.set(poolId, new Set());
          }
          borrowersByPool.get(poolId)!.add(event.margin_manager_id);
        }

        // Set unique counts
        for (const [poolId, suppliers] of suppliersByPool) {
          const metric = newMetrics.get(poolId);
          if (metric) {
            metric.activeSuppliers7d = suppliers.size;
          }
        }

        for (const [poolId, borrowers] of borrowersByPool) {
          const metric = newMetrics.get(poolId);
          if (metric) {
            metric.activeBorrowers7d = borrowers.size;
          }
        }

        setMetrics(newMetrics);
      } catch (err) {
        console.error('Error fetching pool activity metrics:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, [poolIds]);

  return { metrics, isLoading, error };
}
