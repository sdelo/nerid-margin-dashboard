import type { FC } from "react";
import React from "react";
import {
  fetchLoanBorrowed,
  fetchLoanRepaid,
  fetchLiquidations,
  fetchAssetSupplied,
} from "../api/events";
import { useQuery } from "@tanstack/react-query";
import { convertFromSmallestUnits } from "../utils/eventTransform";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton";

type Props = { poolId?: string; limit?: number };

type ActivityEvent = {
  id: string;
  type: "borrow" | "repay" | "liquidation" | "deposit";
  timestamp: number;
  amount: number;
  asset: string;
  transactionDigest: string;
  marginManagerId?: string;
  marginPoolId?: string;
};

export const MarketActivity: FC<Props> = ({ poolId, limit = 10 }) => {
  const params = React.useMemo(
    () => ({
      margin_pool_id: poolId,
      limit: limit * 2, // Fetch more to account for filtering
    }),
    [poolId, limit]
  );

  // Fetch recent events
  const borrowedQuery = useQuery({
    queryKey: ["loanBorrowed", "recent", params],
    queryFn: () => fetchLoanBorrowed(params),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  });

  const repaidQuery = useQuery({
    queryKey: ["loanRepaid", "recent", params],
    queryFn: () => fetchLoanRepaid(params),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const liquidationsQuery = useQuery({
    queryKey: ["liquidation", "recent", params],
    queryFn: () => fetchLiquidations(params),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const depositsQuery = useQuery({
    queryKey: ["assetSupplied", "recent", params],
    queryFn: () => fetchAssetSupplied(params),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const activities = React.useMemo(() => {
    const events: ActivityEvent[] = [];

    // Add borrow events
    borrowedQuery.data?.slice(0, limit).forEach((event) => {
      events.push({
        id: event.event_digest,
        type: "borrow",
        timestamp: event.checkpoint_timestamp_ms,
        amount: convertFromSmallestUnits(event.loan_amount, 9),
        asset: "SUI",
        transactionDigest: event.digest,
        marginManagerId: event.margin_manager_id,
        marginPoolId: event.margin_pool_id,
      });
    });

    // Add repay events
    repaidQuery.data?.slice(0, limit).forEach((event) => {
      events.push({
        id: event.event_digest,
        type: "repay",
        timestamp: event.checkpoint_timestamp_ms,
        amount: convertFromSmallestUnits(event.repay_amount, 9),
        asset: "SUI",
        transactionDigest: event.digest,
        marginManagerId: event.margin_manager_id,
        marginPoolId: event.margin_pool_id,
      });
    });

    // Add liquidation events
    liquidationsQuery.data?.slice(0, limit).forEach((event) => {
      events.push({
        id: event.event_digest,
        type: "liquidation",
        timestamp: event.checkpoint_timestamp_ms,
        amount: convertFromSmallestUnits(event.liquidation_amount, 9),
        asset: "SUI",
        transactionDigest: event.digest,
        marginManagerId: event.margin_manager_id,
        marginPoolId: event.margin_pool_id,
      });
    });

    // Add large deposits (filter for significant amounts)
    depositsQuery.data
      ?.filter((event) => {
        const amount = convertFromSmallestUnits(event.amount, 9);
        return amount >= 100; // Only show deposits >= 100 SUI
      })
      .slice(0, limit)
      .forEach((event) => {
        events.push({
          id: event.event_digest,
          type: "deposit",
          timestamp: event.checkpoint_timestamp_ms,
          amount: convertFromSmallestUnits(event.amount, 9),
          asset: event.asset_type.includes("SUI") ? "SUI" : "DBUSDC",
          transactionDigest: event.digest,
          marginPoolId: event.margin_pool_id,
        });
      });

    // Sort by timestamp (most recent first) and limit
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }, [
    borrowedQuery.data,
    repaidQuery.data,
    liquidationsQuery.data,
    depositsQuery.data,
    limit,
  ]);

  const isLoading =
    borrowedQuery.isLoading ||
    repaidQuery.isLoading ||
    liquidationsQuery.isLoading ||
    depositsQuery.isLoading;

  const getEventTypeColor = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "borrow":
        return "text-teal-400";
      case "repay":
        return "text-emerald-400";
      case "liquidation":
        return "text-rose-400";
      case "deposit":
        return "text-cyan-400";
    }
  };

  const getEventTypeLabel = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "borrow":
        return "Borrow";
      case "repay":
        return "Repay";
      case "liquidation":
        return "Liquidation";
      case "deposit":
        return "Large Deposit";
    }
  };

  const getExplorerUrl = (digest: string) => {
    return `https://suiexplorer.com/txblock/${digest}?network=testnet`;
  };

  if (isLoading) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-cyan-300 drop-shadow">
              Market Activity
            </h2>
            <div className="text-xs text-cyan-100/60 mt-1">
              Real-time feed of recent margin events
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent mb-6"></div>
        <LoadingSkeleton lines={5} height="h-16" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-cyan-300 drop-shadow">
              Market Activity
            </h2>
            <div className="text-xs text-cyan-100/60 mt-1">
              Real-time feed of recent margin events
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent mb-6"></div>
        <EmptyState
          title="No Recent Activity"
          message="No recent margin events found."
        />
      </div>
    );
  }

  return (
    <div className="relative card-surface border border-white/10 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide text-cyan-300 drop-shadow">
            Market Activity
          </h2>
          <div className="text-xs text-cyan-100/60 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Real-time feed of recent margin events
          </div>
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent mb-6"></div>

      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="rounded-xl p-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-all animate-in fade-in slide-in-from-right"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${getEventTypeColor(
                    activity.type
                  )} bg-white/10`}
                >
                  {getEventTypeLabel(activity.type)}
                </span>
                <span className="text-sm text-cyan-100/80">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-bold text-white">
                    {activity.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {activity.asset}
                  </div>
                </div>
                <a
                  href={getExplorerUrl(activity.transactionDigest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:text-cyan-200 underline text-xs"
                >
                  View
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketActivity;

