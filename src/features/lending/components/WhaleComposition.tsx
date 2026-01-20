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
  Legend,
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
  ErrorIcon,
} from "../../../components/ThemedIcons";
import type { PoolOverview } from "../types";
import { useChartFirstRender } from "../../../components/charts/StableChart";

interface WhaleCompositionProps {
  pool: PoolOverview;
}

interface WalletStats {
  address: string;
  participantType: "supplier" | "borrower"; // supplier = supply cap, borrower = margin_manager
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  txCount: number;
  firstSeen: number;
  lastSeen: number;
  isNew: boolean; // New this period
  churned: boolean; // Left this period
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

export function WhaleComposition({ pool }: WhaleCompositionProps) {
  const { serverUrl, network } = useAppNetwork();
  const explorerUrl = NETWORK_CONFIGS[network]?.explorerUrl || "https://suivision.xyz";
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [wallets, setWallets] = React.useState<WalletStats[]>([]);
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
        setWallets([]);

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

        // Build wallet stats
        const walletMap = new Map<string, WalletStats>();

        const getOrCreate = (address: string, timestamp: number, participantType: "supplier" | "borrower"): WalletStats => {
          const existing = walletMap.get(address);
          if (existing) {
            existing.firstSeen = Math.min(existing.firstSeen, timestamp);
            existing.lastSeen = Math.max(existing.lastSeen, timestamp);
            return existing;
          }
          const newWallet: WalletStats = {
            address,
            participantType,
            totalInflow: 0,
            totalOutflow: 0,
            netFlow: 0,
            txCount: 0,
            firstSeen: timestamp,
            lastSeen: timestamp,
            isNew: false,
            churned: false,
          };
          walletMap.set(address, newWallet);
          return newWallet;
        };

        // Process supply events (inflow) - supplier is a supply cap object ID
        supplied.forEach((e) => {
          const wallet = getOrCreate(e.supplier, e.checkpoint_timestamp_ms, "supplier");
          const amount = parseFloat(e.amount) / 10 ** decimals;
          wallet.totalInflow += amount;
          wallet.netFlow += amount;
          wallet.txCount++;
        });

        // Process withdraw events (outflow) - supplier is a supply cap object ID
        withdrawn.forEach((e) => {
          const wallet = getOrCreate(e.supplier, e.checkpoint_timestamp_ms, "supplier");
          const amount = parseFloat(e.amount) / 10 ** decimals;
          wallet.totalOutflow += amount;
          wallet.netFlow -= amount;
          wallet.txCount++;
        });

        // Process borrow events (borrowers, track by margin_manager_id object)
        borrowed.forEach((e) => {
          const wallet = getOrCreate(e.margin_manager_id, e.checkpoint_timestamp_ms, "borrower");
          const amount = parseFloat(e.loan_amount) / 10 ** decimals;
          wallet.totalInflow += amount; // Borrowing is inflow to their position
          wallet.netFlow += amount;
          wallet.txCount++;
        });

        // Process repay events - margin_manager_id is an object
        repaid.forEach((e) => {
          const wallet = getOrCreate(e.margin_manager_id, e.checkpoint_timestamp_ms, "borrower");
          const amount = parseFloat(e.repay_amount) / 10 ** decimals;
          wallet.totalOutflow += amount;
          wallet.netFlow -= amount;
          wallet.txCount++;
        });

        // Calculate new/churned status based on time range
        const now = Date.now();
        
        if (timeRange === "ALL") {
          // For "ALL" time: all wallets are "new" since they all joined at some point
          // Churned = negative net flow (withdrew more than deposited over all time)
          walletMap.forEach((wallet) => {
            wallet.isNew = true;
            wallet.churned = wallet.netFlow < 0;
          });
        } else {
          const rangeMs = {
            "1D": 24 * 60 * 60 * 1000,
            "1W": 7 * 24 * 60 * 60 * 1000,
            "1M": 30 * 24 * 60 * 60 * 1000,
            "3M": 90 * 24 * 60 * 60 * 1000,
            "YTD": (now - new Date(new Date().getFullYear(), 0, 1).getTime()),
          }[timeRange] || 30 * 24 * 60 * 60 * 1000;

          const periodStart = now - rangeMs;
          const recentThreshold = now - rangeMs * 0.2; // Last 20% of period

          walletMap.forEach((wallet) => {
            // New if first seen within this time period
            wallet.isNew = wallet.firstSeen >= periodStart;
            // Churned if net flow is negative and last activity was early in period (not recent)
            wallet.churned = wallet.netFlow < 0 && wallet.lastSeen < recentThreshold;
          });
        }

        setWallets(Array.from(walletMap.values()));
      } catch (err) {
        console.error("Error fetching whale composition:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [timeRange, poolId, decimals, serverUrl]);

  // Helper functions - defined before useMemo hooks that use them
  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + "K";
    return num.toFixed(0);
  };

  const formatAddress = (addr: string) => {
    if (addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Generate explorer URL - all addresses here are object IDs
  const getExplorerUrl = (address: string) => {
    return `${explorerUrl}/object/${address}`;
  };

  // Calculate size buckets based on total flow
  const sizeBuckets = React.useMemo((): SizeBucket[] => {
    const totalVolume = wallets.reduce((sum, w) => sum + Math.abs(w.netFlow), 0);
    
    return SIZE_THRESHOLDS.map((threshold) => {
      const walletsInBucket = wallets.filter((w) => {
        const size = Math.abs(w.netFlow);
        return size >= threshold.min && size < threshold.max;
      });
      const bucketVolume = walletsInBucket.reduce((sum, w) => sum + Math.abs(w.netFlow), 0);
      
      return {
        name: threshold.name,
        range: threshold.max === Infinity 
          ? `>${formatNumber(threshold.min)}` 
          : `${formatNumber(threshold.min)}-${formatNumber(threshold.max)}`,
        count: walletsInBucket.length,
        volume: bucketVolume,
        percentage: totalVolume > 0 ? (bucketVolume / totalVolume) * 100 : 0,
      };
    });
  }, [wallets]);

  // Top inflow/outflow wallets - sort by total amounts, not net flow
  const topInflow = React.useMemo(() => {
    return [...wallets]
      .filter((w) => w.totalInflow > 0)
      .sort((a, b) => b.totalInflow - a.totalInflow)
      .slice(0, 5);
  }, [wallets]);

  const topOutflow = React.useMemo(() => {
    return [...wallets]
      .filter((w) => w.totalOutflow > 0)
      .sort((a, b) => b.totalOutflow - a.totalOutflow)
      .slice(0, 5);
  }, [wallets]);

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(sizeBuckets.length > 0);

  // Composition stats
  const stats = React.useMemo(() => {
    const uniqueSuppliers = new Set<string>();
    const uniqueBorrowers = new Set<string>();
    
    wallets.forEach((w) => {
      if (w.totalInflow > 0 || w.totalOutflow > 0) {
        if (w.participantType === "supplier") {
          uniqueSuppliers.add(w.address);
        } else {
          uniqueBorrowers.add(w.address);
        }
      }
    });

    const newWallets = wallets.filter((w) => w.isNew).length;
    const churnedWallets = wallets.filter((w) => w.churned).length;
    const totalInflow = wallets.reduce((sum, w) => sum + w.totalInflow, 0);
    const totalOutflow = wallets.reduce((sum, w) => sum + w.totalOutflow, 0);

    return {
      uniqueSuppliers: uniqueSuppliers.size,
      uniqueBorrowers: uniqueBorrowers.size,
      totalParticipants: wallets.length,
      newWallets,
      churnedWallets,
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      avgTxPerWallet: wallets.length > 0 
        ? wallets.reduce((sum, w) => sum + w.txCount, 0) / wallets.length 
        : 0,
    };
  }, [wallets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Whale & Composition Analysis
          </h2>
          <p className="text-sm text-white/60">
            Who's moving money and how activity is distributed for {pool.asset}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {isLoading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
            <div className="text-white/60">Analyzing wallet composition...</div>
          </div>
        </div>
      ) : error ? (
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-2 flex justify-center">
              <ErrorIcon size={32} />
            </div>
            <div className="text-red-300 font-semibold mb-1">Error loading data</div>
            <div className="text-white/60 text-sm">{error.message}</div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Unique Wallets</div>
              <div className="text-2xl font-bold text-white">{stats.totalParticipants}</div>
              <div className="text-[10px] text-white/30">Active this period</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-emerald-500/20">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Inflow</div>
              <div className="text-2xl font-bold text-emerald-400">+{formatNumber(stats.totalInflow)}</div>
              <div className="text-[10px] text-white/30">{pool.asset}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-rose-500/20">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Outflow</div>
              <div className="text-2xl font-bold text-rose-400">-{formatNumber(stats.totalOutflow)}</div>
              <div className="text-[10px] text-white/30">{pool.asset}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-cyan-500/20">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">New Wallets</div>
              <div className="text-2xl font-bold text-cyan-400">{stats.newWallets}</div>
              <div className="text-[10px] text-white/30">Joined this period</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-amber-500/20">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Churned</div>
              <div className="text-2xl font-bold text-amber-400">{stats.churnedWallets}</div>
              <div className="text-[10px] text-white/30">Left with outflow</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Avg Txns/Wallet</div>
              <div className="text-2xl font-bold text-white">{stats.avgTxPerWallet.toFixed(1)}</div>
              <div className="text-[10px] text-white/30">Activity level</div>
            </div>
          </div>

          {/* Size Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Size Buckets Bar Chart */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Size Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sizeBuckets}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatNumber(v)}
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => [
                        formatNumber(value),
                        name === "volume" ? "Volume" : "Count",
                      ]}
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
                  <div
                    key={bucket.name}
                    className="flex items-center gap-2 text-xs text-white/60"
                  >
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: BUCKET_COLORS[idx] }}
                    />
                    <span>{bucket.name}:</span>
                    <span className="text-white/80">{bucket.count} wallets</span>
                    <span className="text-white/40">({bucket.percentage.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pie Chart */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Volume by Wallet Size</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sizeBuckets.filter((b) => b.volume > 0)}
                      dataKey="volume"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                      labelLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    >
                      {sizeBuckets.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={BUCKET_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [formatNumber(value), "Volume"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Inflow/Outflow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Inflow */}
            <div className="bg-white/5 rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <span>↓</span> Top Inflow Wallets
              </h3>
              {topInflow.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">No inflow wallets</div>
              ) : (
                <div className="space-y-2">
                  {topInflow.map((wallet, idx) => (
                    <div
                      key={wallet.address}
                      className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-emerald-500/10"
                    >
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={getExplorerUrl(wallet.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-white/60 hover:text-cyan-400 truncate block transition-colors"
                          title={wallet.participantType === "supplier" ? "View Supply Cap" : "View Margin Manager"}
                        >
                          {formatAddress(wallet.address)}
                        </a>
                        <div className="text-[10px] text-white/30">
                          {wallet.txCount} txns • {wallet.participantType === "supplier" ? "Supplier" : "Borrower"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">
                          +{formatNumber(wallet.totalInflow)}
                        </div>
                        <div className="text-[10px] text-white/30">{pool.asset}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Outflow */}
            <div className="bg-white/5 rounded-2xl p-6 border border-rose-500/20">
              <h3 className="text-lg font-bold text-rose-400 mb-4 flex items-center gap-2">
                <span>↑</span> Top Outflow Wallets
              </h3>
              {topOutflow.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">No outflow wallets</div>
              ) : (
                <div className="space-y-2">
                  {topOutflow.map((wallet, idx) => (
                    <div
                      key={wallet.address}
                      className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-rose-500/10"
                    >
                      <span className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-xs font-bold text-rose-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={getExplorerUrl(wallet.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-white/60 hover:text-cyan-400 truncate block transition-colors"
                          title={wallet.participantType === "supplier" ? "View Supply Cap" : "View Margin Manager"}
                        >
                          {formatAddress(wallet.address)}
                        </a>
                        <div className="text-[10px] text-white/30">
                          {wallet.txCount} txns • {wallet.participantType === "supplier" ? "Supplier" : "Borrower"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-rose-400">
                          -{formatNumber(wallet.totalOutflow)}
                        </div>
                        <div className="text-[10px] text-white/30">{pool.asset}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Insight Box */}
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              What This Tells You
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-white/60">
              <div>
                <span className="text-white/80 font-medium">Whale Dominance</span>
                <p className="mt-1">
                  {sizeBuckets[4]?.percentage > 50 ? (
                    <>Whales control {sizeBuckets[4]?.percentage.toFixed(0)}% of volume. High concentration = higher single-point risk.</>
                  ) : (
                    <>Volume is well-distributed across wallet sizes. Lower whale dependency = more stable pool.</>
                  )}
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">Flow Direction</span>
                <p className="mt-1">
                  {stats.netFlow > 0 ? (
                    <>Net inflow of {formatNumber(stats.netFlow)} {pool.asset}. Money flowing in = growing confidence.</>
                  ) : (
                    <>Net outflow of {formatNumber(Math.abs(stats.netFlow))} {pool.asset}. Monitor for sustained exits.</>
                  )}
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">User Growth</span>
                <p className="mt-1">
                  {stats.newWallets > stats.churnedWallets ? (
                    <>{stats.newWallets} new wallets vs {stats.churnedWallets} churned. Healthy user acquisition.</>
                  ) : (
                    <>{stats.churnedWallets} churned vs {stats.newWallets} new. Consider what's driving exits.</>
                  )}
                </p>
              </div>
              <div>
                <span className="text-white/80 font-medium">Engagement</span>
                <p className="mt-1">
                  {stats.avgTxPerWallet > 3 ? (
                    <>High engagement ({stats.avgTxPerWallet.toFixed(1)} txns/wallet). Active, engaged user base.</>
                  ) : (
                    <>Lower engagement ({stats.avgTxPerWallet.toFixed(1)} txns/wallet). Users may be passive holders.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default WhaleComposition;
