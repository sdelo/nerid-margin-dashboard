import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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
import type { PoolOverview } from "../types";
import { useChartFirstRender } from "../../../components/charts/StableChart";

// Seed account to exclude from concentration risk
const DELETED_SEED_ACCOUNT = "0xb51e160d6ee5366a1b2dda76445ed343aadba29873ad92df50725beb427248e1";

interface ConcentrationAnalysisProps {
  pool: PoolOverview;
}

type ViewMode = "concentration" | "composition";

interface ParticipantStats {
  address: string;
  participantType: "supplier" | "borrower";
  netAmount: number;
  supplyAmount: number;
  withdrawAmount: number;
  borrowAmount: number;
  repayAmount: number;
  totalInflow: number;
  totalOutflow: number;
  transactionCount: number;
  firstSeen: number;
  lastSeen: number;
  isDeleted?: boolean;
  isNew: boolean;
  churned: boolean;
}

interface SizeBucket {
  name: string;
  range: string;
  count: number;
  volume: number;
  percentage: number;
}

const SIZE_THRESHOLDS = [
  { name: "Shrimp", min: 0, max: 100 },
  { name: "Fish", min: 100, max: 1000 },
  { name: "Dolphin", min: 1000, max: 10000 },
  { name: "Shark", min: 10000, max: 100000 },
  { name: "Whale", min: 100000, max: Infinity },
];

const BUCKET_COLORS = ["#94a3b8", "#22d3ee", "#2dd4bf", "#fbbf24", "#f43f5e"];

export function ConcentrationAnalysis({ pool }: ConcentrationAnalysisProps) {
  const { serverUrl, network } = useAppNetwork();
  const explorerUrl = NETWORK_CONFIGS[network]?.explorerUrl || "https://suivision.xyz";
  const [timeRange, setTimeRange] = React.useState<TimeRange>("ALL");
  const [viewMode, setViewMode] = React.useState<ViewMode>("concentration");
  const [suppliedEvents, setSuppliedEvents] = React.useState<AssetSuppliedEventResponse[]>([]);
  const [withdrawnEvents, setWithdrawnEvents] = React.useState<AssetWithdrawnEventResponse[]>([]);
  const [borrowedEvents, setBorrowedEvents] = React.useState<LoanBorrowedEventResponse[]>([]);
  const [repaidEvents, setRepaidEvents] = React.useState<LoanRepaidEventResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const decimals = pool.contracts?.coinDecimals ?? 9;
  const poolId = pool.contracts?.marginPoolId;

  // Single shared data fetch
  React.useEffect(() => {
    async function fetchData() {
      if (!poolId) return;
      try {
        setIsLoading(true);
        setError(null);
        setSuppliedEvents([]);
        setWithdrawnEvents([]);
        setBorrowedEvents([]);
        setRepaidEvents([]);
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
        setSuppliedEvents(supplied);
        setWithdrawnEvents(withdrawn);
        setBorrowedEvents(borrowed);
        setRepaidEvents(repaid);
      } catch (err) {
        console.error("Error fetching concentration data:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [timeRange, poolId, serverUrl]);

  // Build unified participant stats (used by both views)
  const allParticipants = React.useMemo(() => {
    const participantMap = new Map<string, ParticipantStats>();

    const getOrCreate = (address: string, timestamp: number, type: "supplier" | "borrower"): ParticipantStats => {
      const existing = participantMap.get(address);
      if (existing) {
        existing.firstSeen = Math.min(existing.firstSeen, timestamp);
        existing.lastSeen = Math.max(existing.lastSeen, timestamp);
        return existing;
      }
      const newP: ParticipantStats = {
        address,
        participantType: type,
        netAmount: 0,
        supplyAmount: 0,
        withdrawAmount: 0,
        borrowAmount: 0,
        repayAmount: 0,
        totalInflow: 0,
        totalOutflow: 0,
        transactionCount: 0,
        firstSeen: timestamp,
        lastSeen: timestamp,
        isDeleted: address === DELETED_SEED_ACCOUNT,
        isNew: false,
        churned: false,
      };
      participantMap.set(address, newP);
      return newP;
    };

    suppliedEvents.forEach((e) => {
      const p = getOrCreate(e.supplier, e.checkpoint_timestamp_ms, "supplier");
      const amount = parseFloat(e.amount) / 10 ** decimals;
      p.supplyAmount += amount;
      p.netAmount += amount;
      p.totalInflow += amount;
      p.transactionCount++;
    });

    withdrawnEvents.forEach((e) => {
      const p = getOrCreate(e.supplier, e.checkpoint_timestamp_ms, "supplier");
      const amount = parseFloat(e.amount) / 10 ** decimals;
      p.withdrawAmount += amount;
      p.netAmount -= amount;
      p.totalOutflow += amount;
      p.transactionCount++;
    });

    borrowedEvents.forEach((e) => {
      const p = getOrCreate(e.margin_manager_id, e.checkpoint_timestamp_ms, "borrower");
      const amount = parseFloat(e.loan_amount) / 10 ** decimals;
      p.borrowAmount += amount;
      p.netAmount += amount;
      p.totalInflow += amount;
      p.transactionCount++;
    });

    repaidEvents.forEach((e) => {
      const p = getOrCreate(e.margin_manager_id, e.checkpoint_timestamp_ms, "borrower");
      const amount = parseFloat(e.repay_amount) / 10 ** decimals;
      p.repayAmount += amount;
      p.netAmount -= amount;
      p.totalOutflow += amount;
      p.transactionCount++;
    });

    // Calculate new/churned status
    const now = Date.now();
    if (timeRange === "ALL") {
      participantMap.forEach((p) => {
        p.isNew = true;
        p.churned = p.netAmount < 0;
      });
    } else {
      const rangeMs: Record<string, number> = {
        "1W": 7 * 24 * 60 * 60 * 1000,
        "1M": 30 * 24 * 60 * 60 * 1000,
        "3M": 90 * 24 * 60 * 60 * 1000,
        "YTD": now - new Date(new Date().getFullYear(), 0, 1).getTime(),
      };
      const rangeDuration = rangeMs[timeRange] || 30 * 24 * 60 * 60 * 1000;
      const periodStart = now - rangeDuration;
      const recentThreshold = now - rangeDuration * 0.2;

      participantMap.forEach((p) => {
        p.isNew = p.firstSeen >= periodStart;
        p.churned = p.netAmount < 0 && p.lastSeen < recentThreshold;
      });
    }

    return Array.from(participantMap.values());
  }, [suppliedEvents, withdrawnEvents, borrowedEvents, repaidEvents, decimals, timeRange]);

  // ── Concentration metrics ──
  const topSuppliers = React.useMemo(() => {
    return allParticipants
      .filter((p) => p.participantType === "supplier" && p.netAmount > 0)
      .sort((a, b) => b.netAmount - a.netAmount)
      .slice(0, 5);
  }, [allParticipants]);

  const activeSuppliers = React.useMemo(() => topSuppliers.filter((s) => !s.isDeleted), [topSuppliers]);

  const topBorrowers = React.useMemo(() => {
    return allParticipants
      .filter((p) => p.participantType === "borrower" && p.netAmount > 0)
      .sort((a, b) => b.netAmount - a.netAmount)
      .slice(0, 5);
  }, [allParticipants]);

  const concentration = React.useMemo(() => {
    const totalActiveSupply = activeSuppliers.reduce((sum, s) => sum + s.netAmount, 0);
    const totalSupply = topSuppliers.reduce((sum, s) => sum + s.netAmount, 0);
    const totalBorrow = topBorrowers.reduce((sum, b) => sum + b.netAmount, 0);
    const top1ActiveSupply = activeSuppliers.length > 0 ? activeSuppliers[0].netAmount : 0;
    const top1Borrow = topBorrowers.length > 0 ? topBorrowers[0].netAmount : 0;
    const supplyConcentration = totalActiveSupply > 0 ? (top1ActiveSupply / totalActiveSupply) * 100 : 0;
    const borrowConcentration = totalBorrow > 0 ? (top1Borrow / totalBorrow) * 100 : 0;

    const hhi = totalActiveSupply > 0
      ? activeSuppliers.reduce((sum, s) => {
          const share = (s.netAmount / totalActiveSupply) * 100;
          return sum + share * share;
        }, 0)
      : 0;

    const gini = (() => {
      if (activeSuppliers.length === 0 || totalActiveSupply === 0) return 0;
      const sortedAmounts = activeSuppliers.map((s) => s.netAmount).sort((a, b) => a - b);
      const n = sortedAmounts.length;
      const sumIndexedValues = sortedAmounts.reduce((sum, amount, i) => sum + (i + 1) * amount, 0);
      const sumValues = sortedAmounts.reduce((sum, amount) => sum + amount, 0);
      const giniCoeff = (2 * sumIndexedValues) / (n * sumValues) - (n + 1) / n;
      return Math.max(0, Math.min(1, giniCoeff));
    })();

    return { totalSupply, totalActiveSupply, totalBorrow, top1ActiveSupply, top1Borrow, supplyConcentration, borrowConcentration, hhi, gini };
  }, [topSuppliers, activeSuppliers, topBorrowers]);

  // ── Composition metrics ──
  const sizeBuckets = React.useMemo((): SizeBucket[] => {
    const totalVolume = allParticipants.reduce((sum, w) => sum + Math.abs(w.netAmount), 0);
    return SIZE_THRESHOLDS.map((threshold) => {
      const walletsInBucket = allParticipants.filter((w) => {
        const size = Math.abs(w.netAmount);
        return size >= threshold.min && size < threshold.max;
      });
      const bucketVolume = walletsInBucket.reduce((sum, w) => sum + Math.abs(w.netAmount), 0);
      return {
        name: threshold.name,
        range: threshold.max === Infinity ? `>${formatNumber(threshold.min)}` : `${formatNumber(threshold.min)}-${formatNumber(threshold.max)}`,
        count: walletsInBucket.length,
        volume: bucketVolume,
        percentage: totalVolume > 0 ? (bucketVolume / totalVolume) * 100 : 0,
      };
    });
  }, [allParticipants]);

  const compositionStats = React.useMemo(() => {
    const suppliers = allParticipants.filter((p) => p.participantType === "supplier");
    const borrowers = allParticipants.filter((p) => p.participantType === "borrower");
    const newWallets = allParticipants.filter((p) => p.isNew).length;
    const churnedWallets = allParticipants.filter((p) => p.churned).length;
    const totalInflow = allParticipants.reduce((sum, w) => sum + w.totalInflow, 0);
    const totalOutflow = allParticipants.reduce((sum, w) => sum + w.totalOutflow, 0);

    return {
      uniqueSuppliers: suppliers.length,
      uniqueBorrowers: borrowers.length,
      totalParticipants: allParticipants.length,
      newWallets,
      churnedWallets,
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      avgTxPerWallet: allParticipants.length > 0
        ? allParticipants.reduce((sum, w) => sum + w.transactionCount, 0) / allParticipants.length
        : 0,
    };
  }, [allParticipants]);

  const topInflow = React.useMemo(() => {
    return [...allParticipants].filter((w) => w.totalInflow > 0).sort((a, b) => b.totalInflow - a.totalInflow).slice(0, 5);
  }, [allParticipants]);

  const topOutflow = React.useMemo(() => {
    return [...allParticipants].filter((w) => w.totalOutflow > 0).sort((a, b) => b.totalOutflow - a.totalOutflow).slice(0, 5);
  }, [allParticipants]);

  const { animationProps } = useChartFirstRender(sizeBuckets.length > 0);

  // Helpers
  const getRiskLevel = (concentrationPercent: number) => {
    if (concentrationPercent > 70) return { label: "Very High", color: "red", icon: <AlertIcon size={20} variant="danger" /> };
    if (concentrationPercent > 50) return { label: "High", color: "orange", icon: <AlertIcon size={20} variant="warning" /> };
    if (concentrationPercent > 30) return { label: "Moderate", color: "yellow", icon: <BoltIcon size={20} /> };
    return { label: "Low", color: "green", icon: <CheckIcon size={20} /> };
  };

  const supplyRisk = getRiskLevel(concentration.supplyConcentration);
  const borrowRisk = getRiskLevel(concentration.borrowConcentration);

  const formatAddress = (addr: string) => addr.length < 12 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const getExplorerUrl = (address: string) => `${explorerUrl}/object/${address}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Concentration & Composition
          </h2>
          <p className="text-sm text-white/60">
            Position concentration risk and wallet composition for {pool.asset}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode("concentration")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "concentration"
                  ? "bg-purple-500 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              Risk
            </button>
            <button
              onClick={() => setViewMode("composition")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "composition"
                  ? "bg-cyan-500 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              Composition
            </button>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
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
            <div className="text-red-300 font-semibold mb-1">Error loading data</div>
            <div className="text-white/60 text-sm">{error.message}</div>
          </div>
        </div>
      ) : viewMode === "concentration" ? (
        /* ═══════ CONCENTRATION VIEW ═══════ */
        <>
          {/* Concentration Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`bg-white/5 rounded-2xl p-4 border ${
              supplyRisk.color === "red" ? "border-red-500/30" :
              supplyRisk.color === "orange" ? "border-amber-500/30" : "border-teal-500/30"
            }`}>
              <div className="text-sm text-white/60 mb-1">Supply Concentration</div>
              <div className={`text-xl font-bold ${
                supplyRisk.color === "red" ? "text-red-400" :
                supplyRisk.color === "orange" ? "text-amber-400" : "text-teal-400"
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
            <div className={`bg-white/5 rounded-2xl p-4 border ${
              borrowRisk.color === "red" ? "border-red-500/30" :
              borrowRisk.color === "orange" ? "border-amber-500/30" : "border-white/10"
            }`}>
              <div className="text-sm text-white/60 mb-1">Borrow Concentration</div>
              <div className={`text-xl font-bold ${
                borrowRisk.color === "red" ? "text-red-400" :
                borrowRisk.color === "orange" ? "text-amber-400" : "text-emerald-400"
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

          {/* Gini & HHI */}
          <div className="flex items-center gap-6 px-4 py-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Gini:</span>
              <span className={`text-sm font-mono font-semibold ${
                concentration.gini > 0.6 ? "text-red-400" : concentration.gini > 0.4 ? "text-amber-400" : "text-emerald-400"
              }`}>{concentration.gini.toFixed(2)}</span>
              <span className="text-[10px] text-white/30">
                ({concentration.gini > 0.6 ? "High inequality" : concentration.gini > 0.4 ? "Moderate" : "Low inequality"})
              </span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">HHI:</span>
              <span className={`text-sm font-mono font-semibold ${
                concentration.hhi > 2500 ? "text-red-400" : concentration.hhi > 1500 ? "text-amber-400" : "text-emerald-400"
              }`}>{Math.round(concentration.hhi).toLocaleString()}</span>
              <span className="text-[10px] text-white/30">
                ({concentration.hhi > 2500 ? "Highly concentrated" : concentration.hhi > 1500 ? "Moderate" : "Competitive"})
              </span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Participants:</span>
              <span className="text-sm font-mono font-semibold text-white">
                {compositionStats.uniqueSuppliers}S / {compositionStats.uniqueBorrowers}B
              </span>
              <span className="text-[10px] text-white/30">
                ({compositionStats.newWallets} new, {compositionStats.churnedWallets} churned)
              </span>
            </div>
          </div>

          {/* Top 5 Lists */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="text-lg font-bold text-cyan-200 mb-3">Top 5 Suppliers</h3>
              {topSuppliers.length === 0 ? (
                <div className="text-center py-4 text-white/30 text-xs">No suppliers found</div>
              ) : (
                <div className="space-y-1.5">
                  {topSuppliers.map((supplier, idx) => (
                    <div key={supplier.address} className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-colors ${
                      supplier.isDeleted ? "bg-white/[0.01] border-white/5 opacity-60" : "bg-white/[0.03] border-white/5 hover:border-cyan-500/20"
                    }`}>
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        supplier.isDeleted ? "bg-white/5 text-white/30" :
                        idx === 0 ? "bg-amber-500/20 text-teal-400" :
                        idx === 1 ? "bg-slate-500/20 text-slate-300" :
                        idx === 2 ? "bg-orange-500/20 text-orange-300" : "bg-white/10 text-white/50"
                      }`}>{idx + 1}</span>
                      <a href={getExplorerUrl(supplier.address)} target="_blank" rel="noopener noreferrer"
                        className={`font-mono text-[10px] truncate transition-colors ${
                          supplier.isDeleted ? "text-white/40" : "text-white/60 hover:text-cyan-400"
                        }`}
                        title={supplier.isDeleted ? "Deleted seed capital account" : "View Supply Cap"}
                      >
                        {formatAddress(supplier.address)}
                      </a>
                      {supplier.isDeleted && (
                        <span className="px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide bg-white/10 text-white/50 rounded">DELETED</span>
                      )}
                      <span className={`text-xs font-semibold ml-auto ${supplier.isDeleted ? "text-white/40" : "text-white"}`}>
                        {supplier.netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className={`text-[10px] ${supplier.isDeleted ? "text-white/30" : "text-cyan-400"}`}>
                        {concentration.totalSupply > 0 ? ((supplier.netAmount / concentration.totalSupply) * 100).toFixed(1) : "0"}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                      <a href={getExplorerUrl(borrower.address)} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-[10px] text-white/60 hover:text-cyan-400 truncate flex-1 transition-colors"
                        title="View Margin Manager"
                      >
                        {formatAddress(borrower.address)}
                      </a>
                      <span className="text-xs font-semibold text-white">{borrower.netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-[10px] text-teal-400">
                        {concentration.totalBorrow > 0 ? ((borrower.netAmount / concentration.totalBorrow) * 100).toFixed(1) : "0"}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ═══════ COMPOSITION VIEW ═══════ */
        <>
          {/* Composition Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Unique Wallets</div>
              <div className="text-2xl font-bold text-white">{compositionStats.totalParticipants}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-emerald-500/20">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Inflow</div>
              <div className="text-2xl font-bold text-emerald-400">+{formatNumber(compositionStats.totalInflow)}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-rose-500/20">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Outflow</div>
              <div className="text-2xl font-bold text-rose-400">-{formatNumber(compositionStats.totalOutflow)}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-cyan-500/20">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">New Wallets</div>
              <div className="text-2xl font-bold text-cyan-400">{compositionStats.newWallets}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-amber-500/20">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Churned</div>
              <div className="text-2xl font-bold text-amber-400">{compositionStats.churnedWallets}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Avg Txns/Wallet</div>
              <div className="text-2xl font-bold text-white">{compositionStats.avgTxPerWallet.toFixed(1)}</div>
            </div>
          </div>

          {/* Size Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Size Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sizeBuckets} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" tickFormatter={(v) => formatNumber(v)} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} width={60} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }}
                      formatter={(value: number) => [formatNumber(value), "Volume"]}
                    />
                    <Bar dataKey="volume" fill="#22d3ee" radius={[0, 4, 4, 0]} {...animationProps}>
                      {sizeBuckets.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={BUCKET_COLORS[index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {sizeBuckets.map((bucket, idx) => (
                  <div key={bucket.name} className="flex items-center gap-2 text-xs text-white/60">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[idx] }} />
                    <span>{bucket.name}:</span>
                    <span className="text-white/80">{bucket.count}</span>
                    <span className="text-white/40">({bucket.percentage.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Volume by Wallet Size</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sizeBuckets.filter((b) => b.volume > 0)}
                      dataKey="volume"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={2}
                      label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                      labelLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    >
                      {sizeBuckets.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={BUCKET_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }}
                      formatter={(value: number) => [formatNumber(value), "Volume"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Inflow/Outflow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <span>↓</span> Top Inflow
              </h3>
              {topInflow.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">No inflow wallets</div>
              ) : (
                <div className="space-y-2">
                  {topInflow.map((wallet, idx) => (
                    <div key={wallet.address} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-emerald-500/10">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <a href={getExplorerUrl(wallet.address)} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-xs text-white/60 hover:text-cyan-400 truncate block transition-colors"
                        >
                          {formatAddress(wallet.address)}
                        </a>
                        <div className="text-[10px] text-white/30">
                          {wallet.transactionCount} txns • {wallet.participantType === "supplier" ? "Supplier" : "Borrower"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">+{formatNumber(wallet.totalInflow)}</div>
                        <div className="text-[10px] text-white/30">{pool.asset}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-rose-500/20">
              <h3 className="text-lg font-bold text-rose-400 mb-4 flex items-center gap-2">
                <span>↑</span> Top Outflow
              </h3>
              {topOutflow.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">No outflow wallets</div>
              ) : (
                <div className="space-y-2">
                  {topOutflow.map((wallet, idx) => (
                    <div key={wallet.address} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-rose-500/10">
                      <span className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-xs font-bold text-rose-400">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <a href={getExplorerUrl(wallet.address)} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-xs text-white/60 hover:text-cyan-400 truncate block transition-colors"
                        >
                          {formatAddress(wallet.address)}
                        </a>
                        <div className="text-[10px] text-white/30">
                          {wallet.transactionCount} txns • {wallet.participantType === "supplier" ? "Supplier" : "Borrower"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-rose-400">-{formatNumber(wallet.totalOutflow)}</div>
                        <div className="text-[10px] text-white/30">{pool.asset}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Insight Box */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          {viewMode === "concentration" ? (
            <>
              <div>
                <span className="text-white/80 font-medium">Supply Risk</span>
                <p className="mt-1">
                  {concentration.supplyConcentration > 50
                    ? <>Top supplier controls {concentration.supplyConcentration.toFixed(1)}%. High withdrawal risk.</>
                    : <>Supply well-distributed ({concentration.supplyConcentration.toFixed(1)}% top share). Healthy diversification.</>
                  }
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">Borrow Risk</span>
                <p className="mt-1">
                  {concentration.borrowConcentration > 50
                    ? <>Top borrower has {concentration.borrowConcentration.toFixed(1)}% of debt. Default could impact pool.</>
                    : <>Debt well-distributed ({concentration.borrowConcentration.toFixed(1)}% top share). Lower default risk.</>
                  }
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">Metrics</span>
                <p className="mt-1">
                  HHI &gt; 2500 = highly concentrated. Gini &gt; 0.6 = high inequality. Lower is better for pool stability.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-white/80 font-medium">Whale Dominance</span>
                <p className="mt-1">
                  {(sizeBuckets[4]?.percentage ?? 0) > 50
                    ? <>Whales control {sizeBuckets[4]?.percentage.toFixed(0)}% of volume. High concentration = higher single-point risk.</>
                    : <>Volume well-distributed across wallet sizes. Lower whale dependency = more stable pool.</>
                  }
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">User Growth</span>
                <p className="mt-1">
                  {compositionStats.newWallets > compositionStats.churnedWallets
                    ? <>{compositionStats.newWallets} new wallets vs {compositionStats.churnedWallets} churned. Healthy user acquisition.</>
                    : <>{compositionStats.churnedWallets} churned vs {compositionStats.newWallets} new. Consider what's driving exits.</>
                  }
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">Flow Direction</span>
                <p className="mt-1">
                  {compositionStats.netFlow > 0
                    ? <>Net inflow of {formatNumber(compositionStats.netFlow)} {pool.asset}. Money flowing in = growing confidence.</>
                    : <>Net outflow of {formatNumber(Math.abs(compositionStats.netFlow))} {pool.asset}. Monitor for sustained exits.</>
                  }
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toFixed(0);
}

export default ConcentrationAnalysis;
