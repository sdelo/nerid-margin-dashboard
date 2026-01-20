import type { FC } from "react";
import React from "react";
import { useUserActivity } from "../hooks/useUserActivity";
import { useAppNetwork } from "../../../context/AppNetworkContext";

type Props = {
  address?: string | null;
  poolId?: string;
  supplierCapIds?: string[]; // Added: array of SupplierCap IDs to filter by
};

export const DepositHistory: FC<Props> = ({
  address,
  poolId,
  supplierCapIds,
}) => {
  const { transactions, isLoading, error, refetch } = useUserActivity(
    address || undefined,
    poolId,
    undefined, // timeRange
    supplierCapIds
  );
  const { explorerUrl } = useAppNetwork();
  const [isRefetching, setIsRefetching] = React.useState(false);

  // Get Sui explorer URL based on network
  const getExplorerUrl = (digest: string) => {
    return `${explorerUrl}/txblock/${digest}`;
  };

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefetching(true);
    await refetch();
    setTimeout(() => setIsRefetching(false), 500);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-cyan-200/70 text-sm">
            Loading transaction history...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-rose-900/20 border border-rose-700/50 rounded-lg p-4">
          <p className="text-rose-400 text-sm">
            Error loading transaction history. Please try again.
          </p>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-6 text-center">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-cyan-400/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-cyan-200/60 text-sm">
            Connect your wallet to view your transaction history.
          </p>
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-6 text-center">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-cyan-400/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-cyan-200/60 text-sm mb-3">
            No transactions found for this address.
          </p>
          <button
            onClick={handleRefresh}
            disabled={isRefetching}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg border border-cyan-500/20 transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRefetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-cyan-200/60">
          {transactions.length} transaction
          {transactions.length !== 1 ? "s" : ""} found
        </p>
        <button
          onClick={handleRefresh}
          disabled={isRefetching}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg border border-cyan-500/20 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRefetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-sm font-semibold capitalize ${
                  tx.type === "supply" ? "text-emerald-400" : "text-teal-400"
                }`}
              >
                {tx.type}
              </span>
              <span className="text-xs text-cyan-200/50">
                {new Date(tx.timestamp).toLocaleDateString()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-cyan-200/50 text-xs mb-1">Asset</div>
                <div className="text-cyan-100">
                  {tx.assetType.includes("SUI") ? "SUI" : "DBUSDC"}
                </div>
              </div>
              <div>
                <div className="text-cyan-200/50 text-xs mb-1">Amount</div>
                <div className="text-cyan-100">{tx.formattedAmount}</div>
              </div>
              <div>
                <div className="text-cyan-200/50 text-xs mb-1">Shares</div>
                <div className="text-cyan-200/80">
                  {tx.shares.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-cyan-200/50 text-xs mb-1">Transaction</div>
                <a
                  href={getExplorerUrl(tx.transactionDigest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                >
                  View
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-cyan-500/20 bg-cyan-900/20">
              <th className="py-3 px-4 text-cyan-200/60 font-medium">Time</th>
              <th className="py-3 px-4 text-cyan-200/60 font-medium">Type</th>
              <th className="py-3 px-4 text-cyan-200/60 font-medium">Asset</th>
              <th className="py-3 px-4 text-cyan-200/60 font-medium">Amount</th>
              <th className="py-3 px-4 text-cyan-200/60 font-medium">Shares</th>
              <th className="py-3 px-4 text-cyan-200/60 font-medium">
                Transaction
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyan-500/10">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-cyan-500/5 transition-colors">
                <td className="py-3 px-4 text-cyan-200/80">
                  {new Date(tx.timestamp).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`capitalize font-medium ${
                      tx.type === "supply"
                        ? "text-emerald-400"
                        : "text-teal-400"
                    }`}
                  >
                    {tx.type}
                  </span>
                </td>
                <td className="py-3 px-4 text-cyan-100">
                  {tx.assetType.includes("SUI") ? "SUI" : "DBUSDC"}
                </td>
                <td className="py-3 px-4 text-cyan-100 font-medium">
                  {tx.formattedAmount}
                </td>
                <td className="py-3 px-4 text-cyan-200/80">
                  {tx.shares.toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <a
                    href={getExplorerUrl(tx.transactionDigest)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                  >
                    View
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DepositHistory;
