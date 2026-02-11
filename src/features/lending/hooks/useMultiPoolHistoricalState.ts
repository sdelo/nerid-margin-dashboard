import React from "react";
import { useQueries } from "@tanstack/react-query";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLoanBorrowed,
  fetchLoanRepaid,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import type { PoolOverview } from "../types";

export interface MultiPoolDataPoint {
  date: string;
  timestamp: number;
  /** Keyed by pool asset name, e.g. { SUI: 650000, USDC: 2000000 } */
  [key: string]: number | string;
}

export interface PoolSnapshotSeries {
  asset: string;
  poolId: string;
  data: Array<{
    date: string;
    timestamp: number;
    supply: number;
    borrow: number;
    utilization: number;
    netFlow: number;
  }>;
}

export interface UseMultiPoolHistoricalStateResult {
  /** Merged data points keyed by date, with per-pool metric values */
  mergedData: MultiPoolDataPoint[];
  /** Per-pool series for more granular access */
  seriesMap: Map<string, PoolSnapshotSeries>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Build a PoolSnapshotSeries from raw event data.
 * Pure computation — no side effects.
 */
function buildSeriesFromEvents(
  pool: PoolOverview,
  supplied: Awaited<ReturnType<typeof fetchAssetSupplied>>,
  withdrawn: Awaited<ReturnType<typeof fetchAssetWithdrawn>>,
  borrowed: Awaited<ReturnType<typeof fetchLoanBorrowed>>,
  repaid: Awaited<ReturnType<typeof fetchLoanRepaid>>,
  timeRange: TimeRange,
): PoolSnapshotSeries {
  const decimals = pool.contracts?.coinDecimals ?? 9;

  interface RawEvent {
    timestamp: number;
    type: "supply" | "withdraw" | "borrow" | "repay";
    amount: number;
  }

  const events: RawEvent[] = [];
  supplied.forEach((e) =>
    events.push({ timestamp: e.checkpoint_timestamp_ms, type: "supply", amount: parseFloat(e.amount) / 10 ** decimals }),
  );
  withdrawn.forEach((e) =>
    events.push({ timestamp: e.checkpoint_timestamp_ms, type: "withdraw", amount: parseFloat(e.amount) / 10 ** decimals }),
  );
  borrowed.forEach((e) =>
    events.push({ timestamp: e.checkpoint_timestamp_ms, type: "borrow", amount: parseFloat(e.loan_amount) / 10 ** decimals }),
  );
  repaid.forEach((e) =>
    events.push({ timestamp: e.checkpoint_timestamp_ms, type: "repay", amount: parseFloat(e.repay_amount) / 10 ** decimals }),
  );

  // Sort newest → oldest for backward reconstruction
  events.sort((a, b) => b.timestamp - a.timestamp);

  // Daily aggregation
  const dayMap = new Map<
    string,
    { deposits: number; withdrawals: number; borrows: number; repays: number; timestamp: number }
  >();

  events.forEach((e) => {
    const dateStr = new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const existing = dayMap.get(dateStr) || { deposits: 0, withdrawals: 0, borrows: 0, repays: 0, timestamp: e.timestamp };
    if (e.type === "supply") existing.deposits += e.amount;
    else if (e.type === "withdraw") existing.withdrawals += e.amount;
    else if (e.type === "borrow") existing.borrows += e.amount;
    else if (e.type === "repay") existing.repays += e.amount;
    existing.timestamp = Math.max(existing.timestamp, e.timestamp);
    dayMap.set(dateStr, existing);
  });

  // Backward-fill from current state
  let runningSupply = pool.state?.supply ?? 0;
  let runningBorrow = pool.state?.borrow ?? 0;

  const now = new Date();
  const stateSnapshots = new Map<string, { supply: number; borrow: number }>();
  const todayKey = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  stateSnapshots.set(todayKey, { supply: runningSupply, borrow: runningBorrow });

  events.forEach((event) => {
    if (event.type === "supply") runningSupply -= event.amount;
    else if (event.type === "withdraw") runningSupply += event.amount;
    else if (event.type === "borrow") runningBorrow -= event.amount;
    else if (event.type === "repay") runningBorrow += event.amount;

    runningSupply = Math.max(0, runningSupply);
    runningBorrow = Math.max(0, runningBorrow);

    const dateKey = new Date(event.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const existing = stateSnapshots.get(dateKey);
    if (!existing || event.timestamp < (dayMap.get(dateKey)?.timestamp ?? Infinity)) {
      stateSnapshots.set(dateKey, { supply: runningSupply, borrow: runningBorrow });
    }
  });

  // Forward-fill the date range
  const getDays = (range: TimeRange): number => {
    switch (range) {
      case "1W": return 7;
      case "1M": return 30;
      case "3M": return 90;
      case "YTD": {
        const soy = new Date(now.getFullYear(), 0, 1);
        return Math.ceil((now.getTime() - soy.getTime()) / 86400000);
      }
      case "ALL": return 365;
      default: return 30;
    }
  };

  const MIN_DATE = new Date("2026-01-17T00:00:00Z");
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - getDays(timeRange));
  startDate.setHours(0, 0, 0, 0);
  // Never show dates before Jan 17, 2026
  if (startDate < MIN_DATE) startDate.setTime(MIN_DATE.getTime());

  let lastState = { supply: runningSupply, borrow: runningBorrow };
  const series: PoolSnapshotSeries["data"] = [];

  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const snapshot = stateSnapshots.get(dateKey);
    if (snapshot) lastState = snapshot;

    const dayAgg = dayMap.get(dateKey);
    const supply = lastState.supply;
    const borrow = lastState.borrow;
    const utilization = supply > 0 ? Math.min(Math.max((borrow / supply) * 100, 0), 100) : 0;

    series.push({
      date: dateKey,
      timestamp: d.getTime(),
      supply,
      borrow,
      utilization,
      netFlow: (dayAgg?.deposits ?? 0) - (dayAgg?.withdrawals ?? 0),
    });
  }

  return { asset: pool.asset, poolId: pool.id, data: series };
}

/**
 * Fetches historical state for multiple pools and merges into
 * a unified timeline suitable for multi-line Recharts overlays.
 *
 * Each pool's data is cached independently via React Query so that:
 *  - Toggling a pool on/off doesn't re-fetch already-cached pools
 *  - React strict mode doesn't cause duplicate fetches
 *  - Historical data (which rarely changes) stays cached for 5 minutes
 */
export function useMultiPoolHistoricalState(
  pools: PoolOverview[],
  selectedPoolIds: Set<string>,
  timeRange: TimeRange,
): UseMultiPoolHistoricalStateResult {
  const selectedPools = React.useMemo(
    () => pools.filter((p) => selectedPoolIds.has(p.id)),
    [pools, selectedPoolIds],
  );

  // One React Query per selected pool — cached independently
  const queries = useQueries({
    queries: selectedPools.map((pool) => {
      const poolId = pool.contracts?.marginPoolId;
      return {
        queryKey: ["poolHistoricalState", poolId, timeRange],
        queryFn: async (): Promise<PoolSnapshotSeries | null> => {
          if (!poolId) return null;

          const params = {
            ...timeRangeToParams(timeRange),
            margin_pool_id: poolId,
            limit: 1000,
          };

          const _t0 = performance.now();
          const [supplied, withdrawn, borrowed, repaid] = await Promise.all([
            fetchAssetSupplied(params),
            fetchAssetWithdrawn(params),
            fetchLoanBorrowed(params),
            fetchLoanRepaid(params),
          ]);
          console.log(`⏱ [poolHistory] ${pool.asset} 4× indexer: ${(performance.now() - _t0).toFixed(1)}ms`);

          return buildSeriesFromEvents(pool, supplied, withdrawn, borrowed, repaid, timeRange);
        },
        enabled: !!poolId,
        staleTime: 5 * 60_000,       // Consider fresh for 5 minutes
        refetchInterval: 5 * 60_000, // Silent re-fetch every 5 minutes
        refetchOnWindowFocus: false,
        retry: 1,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error as Error | null;

  // Build seriesMap from query results
  const seriesMap = React.useMemo(() => {
    const map = new Map<string, PoolSnapshotSeries>();
    for (const q of queries) {
      if (q.data) {
        map.set(q.data.poolId, q.data);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries.map((q) => q.dataUpdatedAt).join(",")]);

  // Merge all series into a single timeline
  const mergedData = React.useMemo(() => {
    if (seriesMap.size === 0) return [];

    const dateMap = new Map<string, MultiPoolDataPoint>();

    for (const [, series] of seriesMap) {
      for (const pt of series.data) {
        if (!dateMap.has(pt.date)) {
          dateMap.set(pt.date, { date: pt.date, timestamp: pt.timestamp });
        }
        const merged = dateMap.get(pt.date)!;
        merged[`${series.asset}_supply`] = pt.supply;
        merged[`${series.asset}_borrow`] = pt.borrow;
        merged[`${series.asset}_utilization`] = pt.utilization;
        merged[`${series.asset}_netFlow`] = pt.netFlow;
        if (pt.timestamp > (merged.timestamp as number)) {
          merged.timestamp = pt.timestamp;
        }
      }
    }

    return Array.from(dateMap.values()).sort(
      (a, b) => (a.timestamp as number) - (b.timestamp as number),
    );
  }, [seriesMap]);

  return { mergedData, seriesMap, isLoading, error };
}
