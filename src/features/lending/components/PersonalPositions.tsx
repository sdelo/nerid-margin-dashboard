import type { FC } from "react";
import { useState, useMemo, useEffect } from "react";
import type { UserPosition, PoolOverview } from "../types";
import { useUserPositions } from "../../../hooks/useUserPositions";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import { useEnrichedUserPositions } from "../../../hooks/useEnrichedUserPositions";
import { useUserActivity } from "../hooks/useUserActivity";
import { MarketStats } from "./MarketStats";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type Props = {
  userAddress: string | undefined;
  pools: PoolOverview[];
  onShowHistory?: () => void; // Keep for backwards compatibility, but unused now
  positions?: UserPosition[]; // Optional prop to pass pre-fetched positions
};

export const PersonalPositions: FC<Props> = ({
  userAddress,
  pools,
  onShowHistory: _onShowHistory, // Unused now - history is inline
  positions: propPositions,
}) => {
  const {
    data: fetchedPositions,
    error,
    isLoading,
  } = useUserPositions(propPositions ? undefined : userAddress);

  // Use passed positions if available, otherwise use fetched ones
  const positions = propPositions || fetchedPositions;

  // Enrich positions with live on-chain data
  const enrichedPositions = useEnrichedUserPositions(positions, pools);
  const { explorerUrl, indexerStatus } = useAppNetwork();

  // Get SupplierCap IDs for history filtering
  const supplierCapIds = useMemo(() => {
    return enrichedPositions
      .map((pos) => pos.supplierCapId)
      .filter((id): id is string => !!id);
  }, [enrichedPositions]);

  // Fetch transaction history inline
  const { transactions, isLoading: historyLoading } = useUserActivity(
    userAddress,
    undefined,
    undefined,
    supplierCapIds
  );

  // Extract unique SupplierCap IDs from enriched positions
  const uniqueCapIds = useMemo(() => {
    const capIds = new Set(
      enrichedPositions
        .map((pos) => pos.supplierCapId)
        .filter((id): id is string => id !== undefined)
    );
    return Array.from(capIds);
  }, [enrichedPositions]);

  // State for selected SupplierCap (default to first one)
  const [selectedCapId, setSelectedCapId] = useState<string | null>(
    uniqueCapIds.length > 0 ? uniqueCapIds[0] : null
  );

  // Update selectedCapId when uniqueCapIds changes (e.g., after refetch)
  useEffect(() => {
    if (
      uniqueCapIds.length > 0 &&
      (!selectedCapId || !uniqueCapIds.includes(selectedCapId))
    ) {
      setSelectedCapId(uniqueCapIds[0]);
    } else if (uniqueCapIds.length === 0) {
      setSelectedCapId(null);
    }
  }, [uniqueCapIds, selectedCapId]);

  // Filter positions by selected SupplierCap (or show all if only one cap)
  const filteredPositions = useMemo(() => {
    if (uniqueCapIds.length <= 1) {
      return enrichedPositions; // Show all positions if only one cap or no caps
    }
    if (!selectedCapId) {
      return [];
    }
    return enrichedPositions.filter(
      (pos) => pos.supplierCapId === selectedCapId
    );
  }, [enrichedPositions, selectedCapId, uniqueCapIds.length]);

  // Helper function to get pool data for a position
  const getPoolForPosition = (
    position: UserPosition
  ): PoolOverview | undefined => {
    return pools.find((pool) => pool.asset === position.asset);
  };

  // Helper to truncate address for display
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Helper to copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Check if any enriched position is still loading
  const isEnriching = enrichedPositions.some((pos) => pos.isLoading);

  if (isLoading || isEnriching) {
    return (
      <div className="flex flex-col h-full">
        <div className="text-sm font-medium text-slate-300 mb-2">
          My Positions
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          <div className="text-center">
            <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {isLoading ? "Loading positions..." : "Calculating interest..."}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="text-sm font-medium text-slate-300 mb-2">
          My Positions
        </div>
        <div className="flex-1 flex items-center justify-center text-rose-400 text-sm">
          Error loading positions: {error.message}
        </div>
      </div>
    );
  }

  if (!userAddress) {
    return (
      <div className="flex flex-col h-full">
        <div className="text-sm font-medium text-slate-300 mb-2">
          My Positions
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Connect your wallet to view positions
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="text-sm font-medium text-slate-300 mb-2">
          My Positions
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No positions found
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Indexer Health Warning Banner */}
      {!indexerStatus.isHealthy && !indexerStatus.isLoading && (
        <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-300">
                Indexer temporarily unavailable
              </p>
              <p className="text-[10px] text-amber-400/80 mt-0.5">
                {indexerStatus.lagDescription ||
                  "Interest earned may not be calculated accurately."}{" "}
                Balances shown are still accurate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Positions Section - Top half, scrollable */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="text-sm font-medium text-slate-300 mb-2">
          My Positions
        </div>

        {/* SupplierCap Info (compact) */}
        {uniqueCapIds.length >= 1 && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className="text-slate-500">Cap:</span>
            {uniqueCapIds.length > 1 ? (
              <>
                <select
                  value={selectedCapId || ""}
                  onChange={(e) => setSelectedCapId(e.target.value)}
                  className="bg-slate-700/50 border border-slate-600/50 rounded px-2 py-0.5 text-cyan-400 text-xs font-mono focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  {uniqueCapIds.map((capId) => (
                    <option key={capId} value={capId}>
                      {truncateAddress(capId)}
                    </option>
                  ))}
                </select>
                <a
                  href={`${explorerUrl}/object/${selectedCapId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300"
                  title="View in explorer"
                >
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
                <button
                  onClick={() => selectedCapId && copyToClipboard(selectedCapId)}
                  className="px-1.5 py-0.5 bg-slate-700/50 hover:bg-slate-600/50 rounded border border-slate-600/50 text-slate-300 transition-colors"
                  title="Copy"
                >
                  Copy
                </button>
              </>
            ) : (
              <>
                <a
                  href={`${explorerUrl}/object/${uniqueCapIds[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  {truncateAddress(uniqueCapIds[0])}
                  <svg
                    className="w-2.5 h-2.5"
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
                <button
                  onClick={() => copyToClipboard(uniqueCapIds[0])}
                  className="px-1.5 py-0.5 bg-slate-700/50 hover:bg-slate-600/50 rounded border border-slate-600/50 text-slate-300 transition-colors"
                  title="Copy"
                >
                  Copy
                </button>
              </>
            )}
          </div>
        )}

        {/* Positions List - Compact, scrollable */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredPositions.map((pos) => {
            const currentBalance =
              pos.currentValueFromChain || pos.balanceFormatted;
            const interestEarned = pos.interestEarned;
            const isLoadingInterest =
              pos.isLoading || pos.isIndexerPending || !interestEarned;

            return (
              <div
                key={`${pos.supplierCapId}-${pos.asset}`}
                className="px-3 py-2 bg-slate-700/30 rounded-lg border border-slate-700/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">
                      {pos.asset}
                    </span>
                    <span className="text-xs text-slate-500">|</span>
                    <span className="text-xs text-teal-400 font-medium">
                      {currentBalance}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isLoadingInterest ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 border border-teal-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-slate-400">
                          Calculating...
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-400 font-medium">
                        +{interestEarned}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700/50 my-3"></div>

      {/* History Section - Scrollable */}
      <div className="min-h-0 flex flex-col">
        <div className="text-sm font-medium text-slate-300 mb-2">
          Transaction History
        </div>
        <div className="max-h-32 overflow-y-auto pr-1">
          {historyLoading ? (
            <div className="text-center py-2 text-slate-400 text-xs">
              <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
              Loading...
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="text-center py-2 text-slate-500 text-xs">
              No transactions yet
            </div>
          ) : (
            <div className="space-y-1">
              {transactions.slice(0, 5).map((tx) => (
                <a
                  key={tx.id}
                  href={`${explorerUrl}/txblock/${tx.transactionDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-2 py-1 bg-slate-700/30 rounded-lg border border-slate-700/50 hover:bg-slate-700/40 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium ${
                        tx.type === "supply"
                          ? "text-emerald-400"
                          : "text-teal-400"
                      }`}
                    >
                      {tx.type === "supply" ? "↓" : "↑"}
                    </span>
                    <span className="text-xs text-slate-300">
                      {tx.formattedAmount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </span>
                    <svg
                      className="w-3 h-3 text-slate-500 group-hover:text-cyan-400"
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
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700/50 my-3"></div>

      {/* Market Stats Section */}
      <div className="min-h-0">
        <MarketStats
          poolName={pools[0]?.contracts?.tradingPair || "SUI_USDC"}
          compact
        />
      </div>
    </div>
  );
};

export default PersonalPositions;
