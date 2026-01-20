import React from "react";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  type AssetSuppliedEventResponse,
  type AssetWithdrawnEventResponse,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { useAppNetwork } from "../../../context/AppNetworkContext";

interface SupplierStats {
  address: string;
  totalSupplied: number;
  totalWithdrawn: number;
  netSupply: number;
  transactionCount: number;
}

export function SupplierAnalytics({ poolId }: { poolId?: string }) {
  const { serverUrl } = useAppNetwork();
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [suppliedEvents, setSuppliedEvents] = React.useState<
    AssetSuppliedEventResponse[]
  >([]);
  const [withdrawnEvents, setWithdrawnEvents] = React.useState<
    AssetWithdrawnEventResponse[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Fetch supply/withdraw events - refetch when timeRange, poolId, or serverUrl changes
  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        // Clear old data immediately when server changes
        setSuppliedEvents([]);
        setWithdrawnEvents([]);
        const params = {
          ...timeRangeToParams(timeRange),
          ...(poolId && { margin_pool_id: poolId }),
          limit: 5000,
        };

        const [supplied, withdrawn] = await Promise.all([
          fetchAssetSupplied(params),
          fetchAssetWithdrawn(params),
        ]);

        setSuppliedEvents(supplied);
        setWithdrawnEvents(withdrawn);
        setError(null);
      } catch (err) {
        console.error("Error fetching supplier analytics:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [timeRange, poolId, serverUrl]);

  // Aggregate supplier statistics
  const supplierStats = React.useMemo(() => {
    const stats = new Map<string, SupplierStats>();

    // Process supplied events
    suppliedEvents.forEach((event) => {
      const existing = stats.get(event.supplier) || {
        address: event.supplier,
        totalSupplied: 0,
        totalWithdrawn: 0,
        netSupply: 0,
        transactionCount: 0,
      };

      existing.totalSupplied += parseFloat(event.amount);
      existing.transactionCount++;
      stats.set(event.supplier, existing);
    });

    // Process withdrawn events
    withdrawnEvents.forEach((event) => {
      const existing = stats.get(event.supplier) || {
        address: event.supplier,
        totalSupplied: 0,
        totalWithdrawn: 0,
        netSupply: 0,
        transactionCount: 0,
      };

      existing.totalWithdrawn += parseFloat(event.amount);
      existing.transactionCount++;
      stats.set(event.supplier, existing);
    });

    // Calculate net supply
    stats.forEach((stat) => {
      stat.netSupply = stat.totalSupplied - stat.totalWithdrawn;
    });

    return Array.from(stats.values()).sort((a, b) => b.netSupply - a.netSupply);
  }, [suppliedEvents, withdrawnEvents]);

  // Calculate summary metrics
  const summary = React.useMemo(() => {
    const uniqueSuppliers = supplierStats.length;
    const newSuppliers24h = supplierStats.filter((s) => {
      const supplierEvents = suppliedEvents.filter(
        (e) => e.supplier === s.address
      );
      if (supplierEvents.length === 0) return false;
      const firstEvent = supplierEvents.sort(
        (a, b) => a.checkpoint_timestamp_ms - b.checkpoint_timestamp_ms
      )[0];
      return (
        firstEvent &&
        Date.now() - firstEvent.checkpoint_timestamp_ms < 24 * 60 * 60 * 1000
      );
    }).length;

    return { uniqueSuppliers, newSuppliers24h };
  }, [supplierStats, suppliedEvents]);

  if (error) {
    return (
      <div className="card-surface p-6 rounded-3xl border border-red-500/20">
        <p className="text-red-400">
          Error loading supplier analytics: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-cyan-200">Supplier Analytics</h2>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-surface p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">👥</span>
            {isLoading && (
              <div className="animate-pulse h-2 w-2 rounded-full bg-cyan-400"></div>
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {isLoading ? (
              <div className="h-8 w-16 bg-white/10 rounded animate-pulse"></div>
            ) : (
              summary.uniqueSuppliers.toLocaleString()
            )}
          </div>
          <div className="text-sm text-white/60">Unique Suppliers</div>
        </div>

        <div className="card-surface p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">🆕</span>
            {isLoading && (
              <div className="animate-pulse h-2 w-2 rounded-full bg-cyan-400"></div>
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {isLoading ? (
              <div className="h-8 w-16 bg-white/10 rounded animate-pulse"></div>
            ) : (
              summary.newSuppliers24h.toLocaleString()
            )}
          </div>
          <div className="text-sm text-white/60">New Suppliers (24h)</div>
        </div>

        <div className="card-surface p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">📊</span>
            {isLoading && (
              <div className="animate-pulse h-2 w-2 rounded-full bg-cyan-400"></div>
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {isLoading ? (
              <div className="h-8 w-16 bg-white/10 rounded animate-pulse"></div>
            ) : (
              (suppliedEvents.length + withdrawnEvents.length).toLocaleString()
            )}
          </div>
          <div className="text-sm text-white/60">Total Transactions</div>
        </div>
      </div>

      {/* Top Suppliers by Net Supply */}
      <div className="card-surface p-6 rounded-2xl border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">
          Top 20 Suppliers by Net Supply
        </h3>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 bg-white/5 rounded animate-pulse"
              ></div>
            ))}
          </div>
        ) : supplierStats.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-lg font-semibold">No Suppliers</p>
            <p className="text-sm mt-2">
              No supply activity in the selected time range
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/60 font-semibold">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 text-white/60 font-semibold">
                    Supplier
                  </th>
                  <th className="text-right py-3 px-4 text-white/60 font-semibold">
                    Total Supplied
                  </th>
                  <th className="text-right py-3 px-4 text-white/60 font-semibold">
                    Total Withdrawn
                  </th>
                  <th className="text-right py-3 px-4 text-white/60 font-semibold">
                    Net Supply
                  </th>
                  <th className="text-right py-3 px-4 text-white/60 font-semibold">
                    Txns
                  </th>
                </tr>
              </thead>
              <tbody>
                {supplierStats.slice(0, 20).map((supplier, index) => (
                  <tr
                    key={supplier.address}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4 text-white/80">#{index + 1}</td>
                    <td className="py-3 px-4 font-mono text-cyan-300 text-xs">
                      {supplier.address.slice(0, 8)}...
                      {supplier.address.slice(-6)}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      {(supplier.totalSupplied / 1e9).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-white/60">
                      {(supplier.totalWithdrawn / 1e9).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-cyan-300">
                      {(supplier.netSupply / 1e9).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-right text-white/60">
                      {supplier.transactionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Supply Activity Feed */}
      <div className="card-surface p-6 rounded-2xl border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">
          Recent Supply Activity
        </h3>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 bg-white/5 rounded animate-pulse"
              ></div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {suppliedEvents
              .sort(
                (a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms
              )
              .slice(0, 20)
              .map((event, index) => (
                <div
                  key={index}
                  className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-green-400 font-semibold text-sm">
                      Supply
                    </span>
                    <span className="text-xs text-white/60">
                      {new Date(event.checkpoint_timestamp_ms).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-300">
                      {event.supplier.slice(0, 8)}...{event.supplier.slice(-6)}
                    </span>
                    <span className="text-white font-semibold">
                      {(parseFloat(event.amount) / 1e9).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
