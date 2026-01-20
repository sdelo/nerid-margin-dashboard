import React from "react";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLoanBorrowed,
  fetchLoanRepaid,
  type AssetSuppliedEventResponse,
  type AssetWithdrawnEventResponse,
  type LoanBorrowedEventResponse,
  type LoanRepaidEventResponse,
} from "../api/events";
import { type TimeRange, timeRangeToParams } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import { NETWORK_CONFIGS } from "../../../config/networks";
import {
  CheckIcon,
  AlertIcon,
  BoltIcon,
  ErrorIcon,
} from "../../../components/ThemedIcons";

interface WhaleWatchProps {
  poolId?: string;
  decimals?: number;
  asset?: string; // e.g., "SUI", "DBUSDC"
}

interface ParticipantStats {
  address: string;
  netAmount: number;
  supplyAmount: number;
  withdrawAmount: number;
  borrowAmount: number;
  repayAmount: number;
  transactionCount: number;
}

export function WhaleWatch({ poolId, decimals = 9, asset = "" }: WhaleWatchProps) {
  const { serverUrl, network } = useAppNetwork();
  const explorerUrl = NETWORK_CONFIGS[network]?.explorerUrl || "https://suivision.xyz";
  const [timeRange, setTimeRange] = React.useState<TimeRange>("ALL");
  const [suppliedEvents, setSuppliedEvents] = React.useState<
    AssetSuppliedEventResponse[]
  >([]);
  const [withdrawnEvents, setWithdrawnEvents] = React.useState<
    AssetWithdrawnEventResponse[]
  >([]);
  const [borrowedEvents, setBorrowedEvents] = React.useState<
    LoanBorrowedEventResponse[]
  >([]);
  const [repaidEvents, setRepaidEvents] = React.useState<
    LoanRepaidEventResponse[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Fetch all events - refetch when timeRange, poolId, or serverUrl changes
  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        // Clear old data immediately when server changes
        setSuppliedEvents([]);
        setWithdrawnEvents([]);
        setBorrowedEvents([]);
        setRepaidEvents([]);
        const params = {
          ...timeRangeToParams(timeRange),
          ...(poolId && { margin_pool_id: poolId }),
          limit: 10000,
        };

        const [supplied, withdrawn, borrowed, repaid] = await Promise.all([
          fetchAssetSupplied(params),
          fetchAssetWithdrawn(params),
          fetchLoanBorrowed(params),
          fetchLoanRepaid(params),
        ]);

        setSuppliedEvents(supplied);
        setWithdrawnEvents(withdrawn);
        setBorrowedEvents(borrowed);
        setRepaidEvents(repaid);
        setError(null);
      } catch (err) {
        console.error("Error fetching whale watch data:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [timeRange, poolId, serverUrl]);

  // Calculate top suppliers
  const topSuppliers = React.useMemo(() => {
    const supplierMap = new Map<string, ParticipantStats>();

    // Aggregate supplies
    suppliedEvents.forEach((event) => {
      const existing = supplierMap.get(event.supplier) || {
        address: event.supplier,
        netAmount: 0,
        supplyAmount: 0,
        withdrawAmount: 0,
        borrowAmount: 0,
        repayAmount: 0,
        transactionCount: 0,
      };
      const amount = parseFloat(event.amount) / 10 ** decimals;
      existing.supplyAmount += amount;
      existing.netAmount += amount;
      existing.transactionCount += 1;
      supplierMap.set(event.supplier, existing);
    });

    // Subtract withdrawals
    withdrawnEvents.forEach((event) => {
      const existing = supplierMap.get(event.supplier);
      if (existing) {
        const amount = parseFloat(event.amount) / 10 ** decimals;
        existing.withdrawAmount += amount;
        existing.netAmount -= amount;
        existing.transactionCount += 1;
      }
    });

    return Array.from(supplierMap.values())
      .filter((s) => s.netAmount > 0)
      .sort((a, b) => b.netAmount - a.netAmount)
      .slice(0, 5);
  }, [suppliedEvents, withdrawnEvents, decimals]);

  // Calculate top borrowers
  const topBorrowers = React.useMemo(() => {
    const borrowerMap = new Map<string, ParticipantStats>();

    // Aggregate borrows
    borrowedEvents.forEach((event) => {
      const existing = borrowerMap.get(event.margin_manager_id) || {
        address: event.margin_manager_id,
        netAmount: 0,
        supplyAmount: 0,
        withdrawAmount: 0,
        borrowAmount: 0,
        repayAmount: 0,
        transactionCount: 0,
      };
      const amount = parseFloat(event.loan_amount) / 10 ** decimals;
      existing.borrowAmount += amount;
      existing.netAmount += amount;
      existing.transactionCount += 1;
      borrowerMap.set(event.margin_manager_id, existing);
    });

    // Subtract repayments
    repaidEvents.forEach((event) => {
      const existing = borrowerMap.get(event.margin_manager_id);
      if (existing) {
        const amount = parseFloat(event.repay_amount) / 10 ** decimals;
        existing.repayAmount += amount;
        existing.netAmount -= amount;
        existing.transactionCount += 1;
      }
    });

    return Array.from(borrowerMap.values())
      .filter((b) => b.netAmount > 0)
      .sort((a, b) => b.netAmount - a.netAmount)
      .slice(0, 5);
  }, [borrowedEvents, repaidEvents, decimals]);

  // Calculate concentration metrics
  const concentration = React.useMemo(() => {
    const totalSupply = topSuppliers.reduce((sum, s) => sum + s.netAmount, 0);
    const totalBorrow = topBorrowers.reduce((sum, b) => sum + b.netAmount, 0);

    const top1Supply = topSuppliers.length > 0 ? topSuppliers[0].netAmount : 0;
    const top1Borrow = topBorrowers.length > 0 ? topBorrowers[0].netAmount : 0;

    const supplyConcentration =
      totalSupply > 0 ? (top1Supply / totalSupply) * 100 : 0;
    const borrowConcentration =
      totalBorrow > 0 ? (top1Borrow / totalBorrow) * 100 : 0;

    // Calculate HHI (Herfindahl-Hirschman Index)
    const hhi = totalSupply > 0 
      ? topSuppliers.reduce((sum, s) => {
          const share = (s.netAmount / totalSupply) * 100;
          return sum + share * share;
        }, 0)
      : 0;

    // Calculate Gini coefficient from Lorenz curve
    const gini = (() => {
      if (topSuppliers.length === 0 || totalSupply === 0) return 0;
      const sortedAmounts = topSuppliers.map(s => s.netAmount).sort((a, b) => a - b);
      const n = sortedAmounts.length;
      const sumIndexedValues = sortedAmounts.reduce((sum, amount, i) => sum + (i + 1) * amount, 0);
      const sumValues = sortedAmounts.reduce((sum, amount) => sum + amount, 0);
      const giniCoeff = (2 * sumIndexedValues) / (n * sumValues) - (n + 1) / n;
      return Math.max(0, Math.min(1, giniCoeff));
    })();

    return {
      totalSupply,
      totalBorrow,
      top1Supply,
      top1Borrow,
      supplyConcentration,
      borrowConcentration,
      hhi,
      gini,
    };
  }, [topSuppliers, topBorrowers]);

  // Determine risk level
  const getRiskLevel = (concentrationPercent: number) => {
    if (concentrationPercent > 70)
      return { label: "Very High", color: "red", icon: <AlertIcon size={20} variant="danger" /> };
    if (concentrationPercent > 50)
      return { label: "High", color: "orange", icon: <AlertIcon size={20} variant="warning" /> };
    if (concentrationPercent > 30)
      return { label: "Moderate", color: "yellow", icon: <BoltIcon size={20} /> };
    return { label: "Low", color: "green", icon: <CheckIcon size={20} /> };
  };

  const supplyRisk = getRiskLevel(concentration.supplyConcentration);
  const borrowRisk = getRiskLevel(concentration.borrowConcentration);

  const formatAddress = (addr: string) => {
    if (addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Generate explorer URL - supplier addresses are supply cap objects, borrower addresses are margin manager objects
  const getExplorerUrl = (address: string) => {
    return `${explorerUrl}/object/${address}`;
  };

  return (
    <div className="space-y-6">
      {/* Header - matches Activity tab style */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Concentration
          </h2>
          <p className="text-sm text-white/60">
            Position concentration risk — Top suppliers vs. borrowers{asset ? ` for ${asset}` : ""}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {isLoading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
            <div className="text-white/60">Loading concentration data...</div>
          </div>
        </div>
      ) : error ? (
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-2 flex justify-center"><ErrorIcon size={32} /></div>
            <div className="text-red-300 font-semibold mb-1">
              Error loading data
            </div>
            <div className="text-white/60 text-sm">{error.message}</div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards - matches Activity tab style */}
          <div className="grid grid-cols-2 gap-4">
            {/* Supply Concentration */}
            <div className={`bg-white/5 rounded-2xl p-4 border ${
              supplyRisk.color === "red" ? "border-red-500/30" :
              supplyRisk.color === "orange" ? "border-amber-500/30" :
              "border-teal-500/30"
            }`}>
              <div className="text-sm text-white/60 mb-1">Supply Concentration</div>
              <div className={`text-xl font-bold ${
                supplyRisk.color === "red" ? "text-red-400" :
                supplyRisk.color === "orange" ? "text-amber-400" :
                "text-teal-400"
              }`}>
                {concentration.supplyConcentration.toFixed(1)}%
              </div>
              <div className="text-xs text-white/40 mt-1">{supplyRisk.label} risk</div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full transition-all duration-500 ${
                    supplyRisk.color === "red" ? "bg-red-500" :
                    supplyRisk.color === "orange" ? "bg-amber-500" : "bg-teal-400"
                  }`}
                  style={{ width: `${Math.min(concentration.supplyConcentration, 100)}%` }}
                />
              </div>
            </div>

            {/* Borrow Concentration */}
            <div className={`bg-white/5 rounded-2xl p-4 border ${
              borrowRisk.color === "red" ? "border-red-500/30" :
              borrowRisk.color === "orange" ? "border-amber-500/30" :
              "border-white/10"
            }`}>
              <div className="text-sm text-white/60 mb-1">Borrow Concentration</div>
              <div className={`text-xl font-bold ${
                borrowRisk.color === "red" ? "text-red-400" :
                borrowRisk.color === "orange" ? "text-amber-400" :
                "text-emerald-400"
              }`}>
                {concentration.borrowConcentration.toFixed(1)}%
              </div>
              <div className="text-xs text-white/40 mt-1">{borrowRisk.label} risk</div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full transition-all duration-500 ${
                    borrowRisk.color === "red" ? "bg-red-500" :
                    borrowRisk.color === "orange" ? "bg-amber-500" : "bg-teal-400"
                  }`}
                  style={{ width: `${Math.min(concentration.borrowConcentration, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Gini & HHI Metrics */}
          <div className="flex items-center gap-6 px-4 py-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Gini Coefficient:</span>
              <span className={`text-sm font-mono font-semibold ${
                concentration.gini > 0.6 ? "text-red-400" :
                concentration.gini > 0.4 ? "text-amber-400" :
                "text-emerald-400"
              }`}>
                {concentration.gini.toFixed(2)}
              </span>
              <span className="text-[10px] text-white/30">
                ({concentration.gini > 0.6 ? "High inequality" : concentration.gini > 0.4 ? "Moderate inequality" : "Low inequality"})
              </span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">HHI:</span>
              <span className={`text-sm font-mono font-semibold ${
                concentration.hhi > 2500 ? "text-red-400" :
                concentration.hhi > 1500 ? "text-amber-400" :
                "text-emerald-400"
              }`}>
                {Math.round(concentration.hhi).toLocaleString()}
              </span>
              <span className="text-[10px] text-white/30">
                ({concentration.hhi > 2500 ? "Highly concentrated" : concentration.hhi > 1500 ? "Moderately concentrated" : "Competitive"})
              </span>
            </div>
          </div>

          {/* Top 5 Lists */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top Suppliers */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="text-lg font-bold text-cyan-200 mb-3">Top 5 Suppliers</h3>
              {topSuppliers.length === 0 ? (
                <div className="text-center py-4 text-white/30 text-xs">No suppliers found</div>
              ) : (
                <div className="space-y-1.5">
                  {topSuppliers.map((supplier, idx) => (
                    <div key={supplier.address} className="flex items-center gap-2 px-2 py-1.5 bg-white/[0.03] rounded border border-white/5 hover:border-cyan-500/20 transition-colors">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        idx === 0 ? "bg-amber-500/20 text-teal-400" :
                        idx === 1 ? "bg-slate-500/20 text-slate-300" :
                        idx === 2 ? "bg-orange-500/20 text-orange-300" : "bg-white/10 text-white/50"
                      }`}>{idx + 1}</span>
                      <a
                        href={getExplorerUrl(supplier.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-white/60 hover:text-cyan-400 truncate flex-1 transition-colors"
                        title="View Supply Cap"
                      >
                        {formatAddress(supplier.address)}
                      </a>
                      <span className="text-xs font-semibold text-white">{supplier.netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-[10px] text-cyan-400">{((supplier.netAmount / concentration.totalSupply) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Borrowers */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="text-lg font-bold text-cyan-200 mb-3">Top 5 Borrowers</h3>
              {topBorrowers.length === 0 ? (
                <div className="text-center py-4 text-white/30 text-xs">No borrowers found</div>
              ) : (
                <div className="space-y-1.5">
                  {topBorrowers.map((borrower, idx) => (
                    <div key={borrower.address} className="flex items-center gap-2 px-2 py-1.5 bg-white/[0.03] rounded border border-white/5 hover:border-amber-500/20 transition-colors">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        idx === 0 ? "bg-amber-500/20 text-teal-400" :
                        idx === 1 ? "bg-slate-500/20 text-slate-300" :
                        idx === 2 ? "bg-orange-500/20 text-orange-300" : "bg-white/10 text-white/50"
                      }`}>{idx + 1}</span>
                      <a
                        href={getExplorerUrl(borrower.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-white/60 hover:text-cyan-400 truncate flex-1 transition-colors"
                        title="View Margin Manager"
                      >
                        {formatAddress(borrower.address)}
                      </a>
                      <span className="text-xs font-semibold text-white">{borrower.netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-[10px] text-teal-400">{((borrower.netAmount / concentration.totalBorrow) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Risk Interpretation */}
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              What This Tells You
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
              <div>
                <span className="text-white/80 font-medium">Supply Risk</span>
                <p className="mt-1">
                  {concentration.supplyConcentration > 50 ? (
                    <>Top supplier controls {concentration.supplyConcentration.toFixed(1)}%. High withdrawal risk.</>
                  ) : (
                    <>Supply well-distributed ({concentration.supplyConcentration.toFixed(1)}% top share). Healthy diversification.</>
                  )}
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">Borrow Risk</span>
                <p className="mt-1">
                  {concentration.borrowConcentration > 50 ? (
                    <>Top borrower has {concentration.borrowConcentration.toFixed(1)}% of debt. Default could impact pool.</>
                  ) : (
                    <>Debt well-distributed ({concentration.borrowConcentration.toFixed(1)}% top share). Lower default risk.</>
                  )}
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">Note</span>
                <p className="mt-1">
                  Based on event history in selected range. Lower concentration = lower risk.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
