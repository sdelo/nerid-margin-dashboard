import type { FC } from "react";
import React from "react";
import type { PoolOverview } from "../types";
import { InfoTooltip } from "../../../components/InfoTooltip";

// Fallback icons for when dynamic iconUrl is not available
const FALLBACK_ICONS: Record<string, string> = {
  SUI: "https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png?1727791290",
  DBUSDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
  USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
  DEEP: "https://assets.coingecko.com/coins/images/38087/standard/deep.png?1728614086",
  WAL: "https://assets.coingecko.com/coins/images/54016/standard/walrus.jpg?1737525627",
};
// Get icon from pool's dynamic iconUrl or fall back to static icons
const getPoolIcon = (pool: { asset: string; ui?: { iconUrl?: string | null } }) => 
  pool.ui?.iconUrl || FALLBACK_ICONS[pool.asset] || "";

function formatNumber(n: number | bigint, decimals: number = 2): string {
  const num = Number(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(decimals) + "K";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

type Props = {
  pool: PoolOverview;
  vaultBalance?: number;
  borrowApr?: number;
  marginEnabled?: boolean;
};

export const PoolSnapshotHero: FC<Props> = ({
  pool,
  vaultBalance,
  borrowApr = 0,
  marginEnabled = true,
}) => {
  const utilizationPct =
    pool.state.supply > 0
      ? (pool.state.borrow / pool.state.supply) * 100
      : 0;

  const available = vaultBalance ?? (pool.state.supply - pool.state.borrow);
  
  // Calculate 30d yield estimate (rough: supply APY * 30/365)
  const supplyApy = Number(pool.ui.aprSupplyPct);
  const monthlyYieldPct = (supplyApy * 30) / 365;

  return (
    <div className="card-hero">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Pool Icon */}
          <div className="relative">
            <img
              src={getPoolIcon(pool)}
              alt={pool.asset}
              className="w-12 h-12 rounded-full ring-2 ring-white/10"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-teal-400 rounded-full border-2 border-[#0c1a24] flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-[#0c1a24]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          
          {/* Pool Name */}
          <div>
            <div className="stat-label mb-1">Pool Snapshot</div>
            <h2 className="text-xl font-bold text-white">{pool.asset} / USDC</h2>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {!marginEnabled && (
            <span className="chip-warning">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-6a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Margin Paused
            </span>
          )}
          <span className="badge-live">Live</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Total Liquidity */}
        <div className="kpi-tile">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Total Liquidity</span>
            <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16" />
            </svg>
          </div>
          <div className="stat-hero text-white">
            {formatCurrency(pool.state.supply)}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <TrendIndicator value={4.1} />
            <span className="text-xs text-white/40">(7d)</span>
          </div>
        </div>

        {/* Utilization */}
        <div className="kpi-tile">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Utilization</span>
            <InfoTooltip tooltip="utilization" size="sm" />
          </div>
          <div className="stat-hero text-white">
            {utilizationPct.toFixed(1)}%
          </div>
          <div className="mt-2">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, utilizationPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Supply APY - Brand Highlight */}
        <div className="kpi-tile-brand">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Supply APY</span>
            <InfoTooltip tooltip="supplyAPY" size="sm" />
          </div>
          <div className="stat-hero text-teal-400">
            {supplyApy.toFixed(2)}%
          </div>
          <div className="text-xs text-white/40 mt-1">
            what suppliers earn
          </div>
        </div>

        {/* 30D Net Yield */}
        <div className="kpi-tile">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">30D Net Yield</span>
            <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="stat-hero text-white">
            {monthlyYieldPct.toFixed(2)}%
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-teal-400">↗ stable</span>
          </div>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="section-divider mb-4" />
      
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
        <StatItem label="Supplied" value={formatNumber(pool.state.supply)} unit={pool.asset} />
        <StatItem label="Borrowed" value={formatNumber(pool.state.borrow)} unit={pool.asset} />
        <StatItem label="Available" value={formatNumber(available)} unit={pool.asset} />
        <StatItem label="Borrow APR" value={borrowApr.toFixed(2) + "%"} subtext="what borrowers pay" />
        <StatItem label="Suppliers" value="—" subtext="depositors" />
      </div>
    </div>
  );
};

// Trend indicator component
function TrendIndicator({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={`text-xs font-medium ${isPositive ? 'text-teal-400' : 'text-red-400'}`}>
      {isPositive ? '↗' : '↘'} {isPositive ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

// Stat item component
function StatItem({ 
  label, 
  value, 
  unit, 
  subtext 
}: { 
  label: string; 
  value: string; 
  unit?: string; 
  subtext?: string;
}) {
  return (
    <div>
      <div className="stat-label mb-1">{label}</div>
      <div className="stat-value-sm text-white">
        {value}
        {unit && <span className="text-sm text-white/50 ml-1">{unit}</span>}
      </div>
      {subtext && <div className="text-[10px] text-white/40 mt-0.5">{subtext}</div>}
    </div>
  );
}

export default PoolSnapshotHero;
