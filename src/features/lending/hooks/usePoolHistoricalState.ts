import React from "react";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLoanBorrowed,
  fetchLoanRepaid,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import type { PoolOverview } from "../types";

export interface HistoricalDataPoint {
  date: string;
  timestamp: number;
  supply: number;
  borrow: number;
  availableLiquidity: number;
  utilization: number;
  deposits: number;
  withdrawals: number;
  borrows: number;
  repays: number;
  netFlow: number;
  depositCount: number;
  withdrawCount: number;
  borrowCount: number;
  repayCount: number;
}

export interface UsePoolHistoricalStateResult {
  data: HistoricalDataPoint[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Shared hook that fetches all four event types (supply/withdraw/borrow/repay)
 * and builds a daily historical state timeline.
 *
 * Multiple components can call this with the same pool + timeRange and the data
 * will be cached / shared via React's useMemo (same component tree). For cross-component
 * sharing you'd wrap this in a context; this is the first step.
 */
export function usePoolHistoricalState(
  pool: PoolOverview,
  timeRange: TimeRange,
): UsePoolHistoricalStateResult {
  const { serverUrl } = useAppNetwork();
  const [data, setData] = React.useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const decimals = pool.contracts?.coinDecimals ?? 9;
  const poolId = pool.contracts?.marginPoolId;

  React.useEffect(() => {
    async function fetchData() {
      if (!poolId) return;

      try {
        setIsLoading(true);
        setError(null);

        const params = {
          ...timeRangeToParams(timeRange),
          margin_pool_id: poolId,
          limit: 10000,
        };

        const [supplied, withdrawn, borrowed, repaid] = await Promise.all([
          fetchAssetSupplied(params),
          fetchAssetWithdrawn(params),
          fetchLoanBorrowed(params),
          fetchLoanRepaid(params),
        ]);

        // Build all events with a unified shape
        interface RawEvent {
          timestamp: number;
          type: "supply" | "withdraw" | "borrow" | "repay";
          amount: number;
        }

        const events: RawEvent[] = [];

        supplied.forEach((e) =>
          events.push({
            timestamp: e.checkpoint_timestamp_ms,
            type: "supply",
            amount: parseFloat(e.amount) / 10 ** decimals,
          }),
        );
        withdrawn.forEach((e) =>
          events.push({
            timestamp: e.checkpoint_timestamp_ms,
            type: "withdraw",
            amount: parseFloat(e.amount) / 10 ** decimals,
          }),
        );
        borrowed.forEach((e) =>
          events.push({
            timestamp: e.checkpoint_timestamp_ms,
            type: "borrow",
            amount: parseFloat(e.loan_amount) / 10 ** decimals,
          }),
        );
        repaid.forEach((e) =>
          events.push({
            timestamp: e.checkpoint_timestamp_ms,
            type: "repay",
            amount: parseFloat(e.repay_amount) / 10 ** decimals,
          }),
        );

        // Sort newest → oldest for backward state reconstruction
        events.sort((a, b) => b.timestamp - a.timestamp);

        // Build daily aggregations
        const dayMap = new Map<
          string,
          {
            deposits: number;
            withdrawals: number;
            borrows: number;
            repays: number;
            depositCount: number;
            withdrawCount: number;
            borrowCount: number;
            repayCount: number;
            timestamp: number;
          }
        >();

        events.forEach((e) => {
          const dateStr = new Date(e.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const existing = dayMap.get(dateStr) || {
            deposits: 0,
            withdrawals: 0,
            borrows: 0,
            repays: 0,
            depositCount: 0,
            withdrawCount: 0,
            borrowCount: 0,
            repayCount: 0,
            timestamp: e.timestamp,
          };

          if (e.type === "supply") {
            existing.deposits += e.amount;
            existing.depositCount++;
          } else if (e.type === "withdraw") {
            existing.withdrawals += e.amount;
            existing.withdrawCount++;
          } else if (e.type === "borrow") {
            existing.borrows += e.amount;
            existing.borrowCount++;
          } else if (e.type === "repay") {
            existing.repays += e.amount;
            existing.repayCount++;
          }

          existing.timestamp = Math.max(existing.timestamp, e.timestamp);
          dayMap.set(dateStr, existing);
        });

        // Determine date range
        const now = new Date();
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

        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - getDays(timeRange));
        startDate.setHours(0, 0, 0, 0);

        // Backward-fill state from current on-chain values
        let runningSupply = pool.state?.supply ?? 0;
        let runningBorrow = pool.state?.borrow ?? 0;

        const stateSnapshots = new Map<string, { supply: number; borrow: number }>();
        const todayKey = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        stateSnapshots.set(todayKey, { supply: runningSupply, borrow: runningBorrow });

        // events are sorted newest → oldest
        events.forEach((event) => {
          if (event.type === "supply") runningSupply -= event.amount;
          else if (event.type === "withdraw") runningSupply += event.amount;
          else if (event.type === "borrow") runningBorrow -= event.amount;
          else if (event.type === "repay") runningBorrow += event.amount;

          runningSupply = Math.max(0, runningSupply);
          runningBorrow = Math.max(0, runningBorrow);

          const dateKey = new Date(event.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          // Keep earliest state for each day (state BEFORE that day's events)
          const existing = stateSnapshots.get(dateKey);
          if (!existing || event.timestamp < (dayMap.get(dateKey)?.timestamp ?? Infinity)) {
            stateSnapshots.set(dateKey, { supply: runningSupply, borrow: runningBorrow });
          }
        });

        // Forward-fill the complete date range
        const result: HistoricalDataPoint[] = [];
        let lastState = { supply: runningSupply, borrow: runningBorrow };

        for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
          const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const isToday = d.toDateString() === now.toDateString();
          const snapshot = stateSnapshots.get(dateKey);
          if (snapshot) lastState = snapshot;

          const dayAgg = dayMap.get(dateKey);
          const supply = lastState.supply;
          const borrow = lastState.borrow;
          const available = Math.max(0, supply - borrow);
          const utilization = supply > 0 ? Math.min(Math.max((borrow / supply) * 100, 0), 100) : 0;

          result.push({
            date: isToday ? `${dateKey} (now)` : dateKey,
            timestamp: d.getTime(),
            supply,
            borrow,
            availableLiquidity: available,
            utilization,
            deposits: dayAgg?.deposits ?? 0,
            withdrawals: dayAgg?.withdrawals ?? 0,
            borrows: dayAgg?.borrows ?? 0,
            repays: dayAgg?.repays ?? 0,
            netFlow: (dayAgg?.deposits ?? 0) - (dayAgg?.withdrawals ?? 0),
            depositCount: dayAgg?.depositCount ?? 0,
            withdrawCount: dayAgg?.withdrawCount ?? 0,
            borrowCount: dayAgg?.borrowCount ?? 0,
            repayCount: dayAgg?.repayCount ?? 0,
          });
        }

        setData(result);
      } catch (err) {
        console.error("Error fetching pool historical state:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch data"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [poolId, decimals, serverUrl, timeRange, pool.state]);

  return { data, isLoading, error };
}
