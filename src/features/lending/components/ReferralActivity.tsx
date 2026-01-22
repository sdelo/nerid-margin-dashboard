import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useReferralActivity } from "../hooks/useReferralActivity";
import { type TimeRange, timeRangeToParams } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import { NETWORK_CONFIGS } from "../../../config/networks";
import { ErrorIcon } from "../../../components/ThemedIcons";
import type { PoolOverview } from "../types";
import { useChartFirstRender } from "../../../components/charts/StableChart";

interface ReferralActivityProps {
  pool: PoolOverview;
}

// Colors for pie chart and other visualizations
const COLORS = ["#2dd4bf", "#22d3ee", "#fbbf24", "#f472b6", "#a78bfa", "#94a3b8"];

/**
 * Format address for display (truncate middle)
 */
function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format large numbers with K/M suffix, or show more precision for small values
 * Never uses scientific notation - shows full decimal places for tiny values
 */
function formatAmount(value: number | bigint, decimals: number = 9): string {
  const num = typeof value === "bigint" ? Number(value) / 10 ** decimals : value;
  if (num === 0) return "0.00";
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + "K";
  if (Math.abs(num) >= 1) return num.toFixed(2);
  if (Math.abs(num) >= 0.01) return num.toFixed(4);
  if (Math.abs(num) >= 0.0001) return num.toFixed(6);
  if (Math.abs(num) >= 0.00000001) return num.toFixed(8);
  // For extremely small values, show up to 12 decimals
  return num.toFixed(12).replace(/\.?0+$/, '');
}

/**
 * Format timestamp to relative time or date
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60 * 1000) return "Just now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60 / 1000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 60 / 60 / 1000)}h ago`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 24 / 60 / 60 / 1000)}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Referral Activity section for the Activity tab
 * Shows all referrals in the system, their claim history, and fee distribution
 */
export function ReferralActivity({ pool }: ReferralActivityProps) {
  const { network } = useAppNetwork();
  const explorerUrl = NETWORK_CONFIGS[network]?.explorerUrl || "https://suivision.xyz";
  const [timeRange, setTimeRange] = React.useState<TimeRange>("ALL");
  const [selectedTab, setSelectedTab] = React.useState<"overview" | "referrals" | "fees">("overview");
  const isFirstRender = useChartFirstRender();
  
  const decimals = pool.contracts?.coinDecimals ?? 9;
  const asset = pool.asset || "tokens";
  
  const { referrals, claims, feeDistributions, poolStats, isLoading, isError, error, refetch } = useReferralActivity(pool);

  // Filter data by time range
  const filteredData = React.useMemo(() => {
    const { start_time, end_time } = timeRangeToParams(timeRange);
    const startMs = start_time * 1000;
    const endMs = end_time * 1000;
    
    return {
      referrals: referrals.filter(r => r.createdAt >= startMs && r.createdAt <= endMs),
      claims: claims.filter(c => c.timestamp >= startMs && c.timestamp <= endMs),
      feeDistributions: feeDistributions.filter(f => f.timestamp >= startMs && f.timestamp <= endMs),
    };
  }, [referrals, claims, feeDistributions, timeRange]);

  // Aggregate fee distribution over time for chart
  const feeChartData = React.useMemo(() => {
    const byDay = new Map<string, { referral: bigint; maintainer: bigint; protocol: bigint }>();
    
    filteredData.feeDistributions.forEach((dist) => {
      const date = new Date(dist.timestamp).toISOString().split("T")[0];
      const existing = byDay.get(date) || { referral: 0n, maintainer: 0n, protocol: 0n };
      byDay.set(date, {
        referral: existing.referral + dist.referralFees,
        maintainer: existing.maintainer + dist.maintainerFees,
        protocol: existing.protocol + dist.protocolFees,
      });
    });
    
    return Array.from(byDay.entries())
      .map(([date, fees]) => ({
        date,
        referral: Number(fees.referral) / 10 ** decimals,
        maintainer: Number(fees.maintainer) / 10 ** decimals,
        protocol: Number(fees.protocol) / 10 ** decimals,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData.feeDistributions, decimals]);

  // Fee split for pie chart (convert to proper decimal units)
  const feeSplitData = React.useMemo(() => {
    const totalReferral = filteredData.feeDistributions.reduce((sum, d) => sum + d.referralFees, 0n);
    const totalMaintainer = filteredData.feeDistributions.reduce((sum, d) => sum + d.maintainerFees, 0n);
    const totalProtocol = filteredData.feeDistributions.reduce((sum, d) => sum + d.protocolFees, 0n);
    const total = totalReferral + totalMaintainer + totalProtocol;
    
    if (total === 0n) return [];
    
    const divisor = 10 ** decimals;
    return [
      { name: "Referral (50%)", value: Number(totalReferral) / divisor, color: "#2dd4bf" },
      { name: "Maintainer (25%)", value: Number(totalMaintainer) / divisor, color: "#fbbf24" },
      { name: "Protocol (25%)", value: Number(totalProtocol) / divisor, color: "#94a3b8" },
    ];
  }, [filteredData.feeDistributions, decimals]);

  // Referral share distribution for pie chart
  const referralShareData = React.useMemo(() => {
    // Filter referrals with share data and sort by share percent
    const withShares = referrals
      .filter(r => r.sharePercent !== null && r.sharePercent > 0)
      .sort((a, b) => (b.sharePercent || 0) - (a.sharePercent || 0));
    
    if (withShares.length === 0) return [];
    
    // Take top 5 and group the rest as "Others"
    const top5 = withShares.slice(0, 5);
    const othersShare = withShares.slice(5).reduce((sum, r) => sum + (r.sharePercent || 0), 0);
    
    // sharePercent is already in percentage form (0-100)
    const data = top5.map((ref, i) => ({
      name: formatAddress(ref.referralId),
      fullId: ref.referralId,
      value: ref.sharePercent || 0,
      color: COLORS[i % COLORS.length],
    }));
    
    if (othersShare > 0) {
      data.push({
        name: `Others (${withShares.length - 5})`,
        fullId: "others",
        value: othersShare,
        color: "#475569",
      });
    }
    
    return data;
  }, [referrals]);

  if (isError) {
    return (
      <div className="p-6 text-center">
        <ErrorIcon className="w-12 h-12 mx-auto text-red-400 mb-3" />
        <p className="text-red-400">Failed to load referral data</p>
        <p className="text-slate-500 text-sm mt-1">{error?.message}</p>
        <button
          onClick={refetch}
          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Referral Activity
          </h2>
          <p className="text-sm text-white/60">
            Supply referrals earn 50% of protocol fees proportional to their referred shares
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Referrals</div>
          <div className="text-2xl font-bold text-white">
            {isLoading ? "—" : poolStats.totalReferrals}
          </div>
          <div className="text-[10px] text-white/30">Registered in pool</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-cyan-500/20">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Fees Earned</div>
          <div className="text-2xl font-bold text-cyan-400">
            {isLoading ? "—" : formatAmount(poolStats.totalDistributedReferralFees, decimals)}
          </div>
          <div className="text-[10px] text-white/30">{asset} total to referrals</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-emerald-500/20">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Withdrawn</div>
          <div className="text-2xl font-bold text-emerald-400">
            {isLoading ? "—" : formatAmount(poolStats.totalClaimedFees, decimals)}
          </div>
          <div className="text-[10px] text-white/30">{asset} claimed</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-amber-500/20">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Unclaimed</div>
          <div className="text-2xl font-bold text-amber-400">
            {isLoading ? "—" : formatAmount(
              poolStats.totalDistributedReferralFees - poolStats.totalClaimedFees,
              decimals
            )}
          </div>
          <div className="text-[10px] text-white/30">{asset} waiting</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {([
          { id: "overview", label: "Overview" },
          { id: "referrals", label: "Referrals" },
          { id: "fees", label: "Fee Events" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === tab.id
                ? "bg-cyan-600/20 text-cyan-400 border border-cyan-500/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedTab === "overview" && (
        <div className="space-y-6">
          {/* Top row: Daily Fee Distribution */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white">Daily Fee Distribution</h3>
              <p className="text-xs text-white/40 mt-0.5">Fees earned each day from borrower interest payments</p>
            </div>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-pulse text-white/40">Loading...</div>
              </div>
            ) : feeChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-white/40">
                No fee distributions in selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={feeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.6)" }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis 
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.6)" }} 
                    width={60}
                    label={{ 
                      value: asset, 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: 'rgba(255,255,255,0.5)', textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }}
                    labelStyle={{ color: "#f1f5f9" }}
                    formatter={(value: number) => [value.toFixed(4) + ` ${asset}`, ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="referral"
                    stackId="1"
                    stroke="#2dd4bf"
                    fill="#2dd4bf"
                    fillOpacity={0.6}
                    name="Referral (50%)"
                    isAnimationActive={!isFirstRender}
                  />
                  <Area
                    type="monotone"
                    dataKey="maintainer"
                    stackId="1"
                    stroke="#fbbf24"
                    fill="#fbbf24"
                    fillOpacity={0.6}
                    name="Maintainer (25%)"
                    isAnimationActive={!isFirstRender}
                  />
                  <Area
                    type="monotone"
                    dataKey="protocol"
                    stackId="1"
                    stroke="#94a3b8"
                    fill="#94a3b8"
                    fillOpacity={0.6}
                    name="Protocol (25%)"
                    isAnimationActive={!isFirstRender}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom row: Two pie charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fee Split Pie Chart */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">Fee Split</h3>
                <p className="text-xs text-white/40 mt-0.5">How protocol fees are distributed</p>
              </div>
              {isLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="animate-pulse text-white/40">Loading...</div>
                </div>
              ) : feeSplitData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-white/40">
                  No fees distributed yet
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie
                        data={feeSplitData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                        isAnimationActive={!isFirstRender}
                      >
                        {feeSplitData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {feeSplitData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm text-white">{entry.name}</span>
                        <span className="text-sm text-white/50 ml-auto">
                          {formatAmount(entry.value, 0)} {asset}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Referral Share Distribution Pie Chart */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">Referral Share Distribution</h3>
                <p className="text-xs text-white/40 mt-0.5">Current attribution by referral ID</p>
              </div>
              {isLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="animate-pulse text-white/40">Loading...</div>
                </div>
              ) : referralShareData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-white/40">
                  No referral share data available
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie
                        data={referralShareData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                        isAnimationActive={!isFirstRender}
                      >
                        {referralShareData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, "Share"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 max-h-[150px] overflow-y-auto">
                    {referralShareData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs text-white/80 font-mono truncate">{entry.name}</span>
                        <span className="text-xs text-cyan-400 ml-auto shrink-0">
                          {entry.value.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedTab === "referrals" && (
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white/80">
                    All Referrals ({referrals.length})
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    Sorted by share % — live on-chain data
                  </p>
                </div>
                <div className="text-xs text-white/40">
                  Click ID to view on Suiscan
                </div>
              </div>
            </div>
            
            {isLoading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
                  <div className="text-white/60">Loading referrals...</div>
                </div>
              </div>
            ) : referrals.length === 0 ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-white/40">No referrals found</div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                {/* Column Headers */}
                <div className="px-4 py-2 grid grid-cols-6 gap-2 bg-white/[0.02] text-xs text-white/40 uppercase tracking-wider sticky top-0">
                  <div>Referral ID</div>
                  <div>Owner</div>
                  <div className="text-right">Share %</div>
                  <div className="text-right">Unclaimed</div>
                  <div className="text-right">Withdrawn</div>
                  <div className="text-right">Created</div>
                </div>
                
                {referrals.map((ref) => (
                  <div
                    key={ref.referralId}
                    className="px-4 py-3 hover:bg-white/[0.02] transition-colors grid grid-cols-6 gap-2 items-center"
                  >
                    <a
                      href={`${explorerUrl}/object/${ref.referralId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-cyan-400 hover:text-cyan-300 truncate"
                    >
                      {formatAddress(ref.referralId)}
                    </a>
                    <a
                      href={`${explorerUrl}/address/${ref.owner}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-white/60 hover:text-white truncate"
                    >
                      {formatAddress(ref.owner)}
                    </a>
                    <div className="text-right">
                      {ref.sharePercent !== null ? (
                        <span className={ref.sharePercent > 0 ? "text-cyan-400 font-mono text-sm" : "text-white/40"}>
                          {ref.sharePercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </div>
                    <div className="text-right">
                      {ref.unclaimedFees !== null ? (
                        <span className={ref.unclaimedFees > 0n ? "text-amber-400 font-mono text-xs" : "text-white/40"}>
                          {formatAmount(ref.unclaimedFees, decimals)}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={ref.totalClaimed > 0n ? "text-emerald-400 font-mono text-xs" : "text-white/40"}>
                        {formatAmount(ref.totalClaimed, decimals)}
                      </span>
                    </div>
                    <div className="text-right text-xs text-white/40">
                      {formatTime(ref.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      )}

      {selectedTab === "fees" && (
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white/80">
                Fee Events ({filteredData.feeDistributions.length})
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                Each row shows fees generated when borrowers pay interest or positions are liquidated
              </p>
            </div>
            <div className="text-xs text-white/40">
              Click tx to view on Suiscan
            </div>
          </div>
          
          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
                <div className="text-white/60">Loading fee events...</div>
              </div>
            </div>
          ) : filteredData.feeDistributions.length === 0 ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-center">
                <div className="text-white/40">No fee events in selected period</div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {/* Column Headers */}
              <div className="px-4 py-2 grid grid-cols-6 gap-2 bg-white/[0.02] text-xs text-white/40 uppercase tracking-wider sticky top-0">
                <div>When</div>
                <div className="text-right">Referrals (50%)</div>
                <div className="text-right">Maintainer (25%)</div>
                <div className="text-right">Protocol (25%)</div>
                <div className="text-right">Pool Shares</div>
                <div className="text-right">Tx</div>
              </div>
              
              {filteredData.feeDistributions.map((dist, i) => (
                <div
                  key={`${dist.txDigest}-${i}`}
                  className="px-4 py-3 hover:bg-white/[0.02] transition-colors grid grid-cols-6 gap-2 items-center"
                >
                  <div className="text-xs text-white/40">
                    {formatTime(dist.timestamp)}
                  </div>
                  <div className="text-right font-mono text-xs text-cyan-400">
                    {formatAmount(dist.referralFees, decimals)}
                  </div>
                  <div className="text-right font-mono text-xs text-amber-400">
                    {formatAmount(dist.maintainerFees, decimals)}
                  </div>
                  <div className="text-right font-mono text-xs text-white/60">
                    {formatAmount(dist.protocolFees, decimals)}
                  </div>
                  <div className="text-right font-mono text-xs text-white/40">
                    {formatAmount(dist.totalShares, decimals)}
                  </div>
                  <a
                    href={`${explorerUrl}/txblock/${dist.txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-right px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors text-xs text-cyan-400 font-mono truncate"
                  >
                    {dist.txDigest.slice(0, 8)}...
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* What This Tells You */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mt-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Fee Distribution</span>
            <p className="mt-1">
              Protocol fees are split: 50% to referrals, 25% to maintainer, 25% to protocol. Referral fees are distributed proportionally by attributed supply shares.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Earning Mechanism</span>
            <p className="mt-1">
              Fees accrue continuously as borrowers pay interest. Referrals can claim accumulated fees at any time without penalty.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Share Attribution</span>
            <p className="mt-1">
              A referral's share changes when referred users deposit, withdraw, or switch to a different referral on their next deposit.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Unclaimed Fees</span>
            <p className="mt-1">
              Unclaimed fees are preserved even if shares change. Fees earned while shares were held remain claimable indefinitely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReferralActivity;
