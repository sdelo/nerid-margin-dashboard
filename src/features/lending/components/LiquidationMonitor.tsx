import type { FC } from "react";
import React from "react";
import { useLiquidationEvents } from "../hooks/useEvents";
import { aggregateLiquidationStats } from "../utils/eventTransform";
import { TimeRangeSelector } from "../../../components/TimeRangeSelector";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton";
import type { TimeRange } from "../api/types";

type Props = { poolId?: string };

export const LiquidationMonitor: FC<Props> = ({ poolId }) => {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const liquidationQuery = useLiquidationEvents(poolId, undefined, timeRange);

  const stats = React.useMemo(() => {
    if (!liquidationQuery.data) return null;
    // Determine decimals (default to 9 for SUI)
    const decimals = 9;
    return aggregateLiquidationStats(liquidationQuery.data, decimals);
  }, [liquidationQuery.data]);

  const getExplorerUrl = (digest: string) => {
    return `https://suiexplorer.com/txblock/${digest}?network=testnet`;
  };

  if (liquidationQuery.isLoading) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-rose-400 drop-shadow">
              Liquidation Monitor
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-rose-400/60 to-transparent mb-6"></div>
        <div className="space-y-4">
          <LoadingSkeleton lines={5} height="h-12" />
        </div>
      </div>
    );
  }

  if (liquidationQuery.error) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-rose-400 drop-shadow">
              Liquidation Monitor
            </h2>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-rose-400/60 to-transparent mb-6"></div>
        <div className="text-red-400">Error loading liquidation data. Please try again.</div>
      </div>
    );
  }

  if (!stats || stats.events.length === 0) {
    return (
      <div className="relative card-surface border border-white/10 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide text-rose-400 drop-shadow">
              Liquidation Monitor
            </h2>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-rose-400/60 to-transparent mb-6"></div>
        <EmptyState
          title="No Liquidations"
          message="No liquidation events found for the selected time range."
        />
      </div>
    );
  }

  return (
    <div className="relative card-surface border border-white/10 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide text-rose-400 drop-shadow">
            Liquidation Monitor
          </h2>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-rose-400/60 to-transparent mb-6"></div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div
          className="rounded-2xl p-4 bg-white/5 border"
          style={{
            borderColor: "color-mix(in oklab, var(--color-rose-400) 30%, transparent)",
          }}
        >
          <div className="text-xs text-cyan-100/70 mb-1">Total Liquidations</div>
          <div className="text-2xl font-extrabold text-rose-400">
            {stats.totalCount}
          </div>
        </div>
        <div
          className="rounded-2xl p-4 bg-white/5 border"
          style={{
            borderColor: "color-mix(in oklab, var(--color-rose-400) 30%, transparent)",
          }}
        >
          <div className="text-xs text-cyan-100/70 mb-1">Total Value</div>
          <div className="text-2xl font-extrabold text-rose-400">
            {stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} SUI
          </div>
        </div>
        <div
          className="rounded-2xl p-4 bg-white/5 border"
          style={{
            borderColor: "color-mix(in oklab, var(--color-rose-400) 30%, transparent)",
          }}
        >
          <div className="text-xs text-cyan-100/70 mb-1">Avg Risk Ratio</div>
          <div className="text-2xl font-extrabold text-rose-400">
            {stats.averageRiskRatio.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Liquidation Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-cyan-100/70">
            <tr className="text-left">
              <th className="py-3 pr-4">Time</th>
              <th className="py-3 pr-4">Manager</th>
              <th className="py-3 pr-4">Pool</th>
              <th className="py-3 pr-4">Amount</th>
              <th className="py-3 pr-4">Pool Reward</th>
              <th className="py-3 pr-4">Risk Ratio</th>
              <th className="py-3 pr-4">Transaction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {stats.events.map((event, idx) => {
              const liquidationQueryData = liquidationQuery.data![idx];
              const riskRatioColor =
                event.riskRatio > 150
                  ? "text-red-400"
                  : event.riskRatio > 120
                  ? "text-teal-400"
                  : "text-emerald-400";

              return (
                <tr
                  key={liquidationQueryData.event_digest}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="py-3 pr-4">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-mono text-xs">
                      {event.marginManagerId.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-mono text-xs">
                      {event.marginPoolId.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-semibold text-rose-400">
                    {event.liquidationAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    SUI
                  </td>
                  <td className="py-3 pr-4">
                    {event.poolReward.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    SUI
                  </td>
                  <td className={`py-3 pr-4 font-semibold ${riskRatioColor}`}>
                    {event.riskRatio.toFixed(2)}%
                  </td>
                  <td className="py-3 pr-4">
                    <a
                      href={getExplorerUrl(liquidationQueryData.digest)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:text-cyan-200 underline text-xs"
                    >
                      View
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiquidationMonitor;

