import { useQuery } from '@tanstack/react-query';
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

/**
 * Processes raw event data into pool activity metrics.
 * Pure function — no side-effects, easy to cache via React Query.
 */
function computeMetrics(
  pools: PoolOverview[],
  supplied: Awaited<ReturnType<typeof fetchAssetSupplied>>,
  withdrawn: Awaited<ReturnType<typeof fetchAssetWithdrawn>>,
  borrowed: Awaited<ReturnType<typeof fetchLoanBorrowed>>,
  repaid: Awaited<ReturnType<typeof fetchLoanRepaid>>,
): Map<string, PoolActivityMetrics> {
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

  // Get pool decimals map
  const decimalsMap = new Map<string, number>();
  for (const pool of pools) {
    const poolId = pool.contracts?.marginPoolId;
    if (poolId) {
      decimalsMap.set(poolId, pool.contracts?.coinDecimals ?? 9);
    }
  }

  // Process supplied events
  const suppliersByPool = new Map<string, Set<string>>();
  for (const event of supplied) {
    const poolId = event.margin_pool_id;
    const metric = newMetrics.get(poolId);
    if (!metric) continue;

    const decimals = decimalsMap.get(poolId) ?? 9;
    const amount = parseFloat(event.amount) / (10 ** decimals);
    metric.netFlow7d += amount;
    
    const timestamp = event.checkpoint_timestamp_ms;
    if (!metric.lastSupplyTime || timestamp > metric.lastSupplyTime) {
      metric.lastSupplyTime = timestamp;
    }

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

    if (!borrowersByPool.has(poolId)) {
      borrowersByPool.set(poolId, new Set());
    }
    borrowersByPool.get(poolId)!.add(event.margin_manager_id);
  }

  // Process repaid events
  for (const event of repaid) {
    const poolId = event.margin_pool_id;
    const metric = newMetrics.get(poolId);
    if (!metric) continue;

    const timestamp = event.checkpoint_timestamp_ms;
    if (!metric.lastRepayTime || timestamp > metric.lastRepayTime) {
      metric.lastRepayTime = timestamp;
    }

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

  return newMetrics;
}

export function usePoolActivityMetrics(pools: PoolOverview[]): UsePoolActivityMetricsResult {
  // Create a stable key for pools array
  const poolIds = pools.map(p => p.contracts?.marginPoolId).filter(Boolean);

  const { data: metrics = new Map(), isLoading, error } = useQuery<Map<string, PoolActivityMetrics>>({
    queryKey: ['poolActivityMetrics', ...poolIds],
    queryFn: async () => {
      const timeParams = getTimeParams7d();

      const _t0 = performance.now();
      const [supplied, withdrawn, borrowed, repaid] = await Promise.all([
        fetchAssetSupplied({ ...timeParams, limit: 10000 }),
        fetchAssetWithdrawn({ ...timeParams, limit: 10000 }),
        fetchLoanBorrowed({ ...timeParams, limit: 10000 }),
        fetchLoanRepaid({ ...timeParams, limit: 10000 }),
      ]);
      console.log(`⏱ [poolActivityMetrics] 4× indexer event fetches: ${(performance.now() - _t0).toFixed(1)}ms`);

      return computeMetrics(pools, supplied, withdrawn, borrowed, repaid);
    },
    enabled: poolIds.length > 0,
    staleTime: 5 * 60_000,        // Consider data fresh for 5 minutes
    refetchInterval: 5 * 60_000,  // Auto-refetch every 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return { metrics, isLoading, error: error as Error | null };
}
