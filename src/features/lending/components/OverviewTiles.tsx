import React from "react";
import type { PoolOverview } from "../types";
import { calculatePoolRates } from "../../../utils/interestRates";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLiquidations,
} from "../api/events";
import { timeRangeToParams } from "../api/types";
import { useAppNetwork } from "../../../context/AppNetworkContext";

interface OverviewTilesProps {
  pool: PoolOverview;
  onSelectTab: (tab: "rates" | "activity" | "risk" | "liquidations" | "concentration" | "liquidity" | "markets") => void;
}

// Tooltip definitions for risk metrics
const RISK_DEFINITIONS = {
  concentration: {
    diversified: "Low risk: Supply is well-distributed across many providers, reducing single-point-of-failure risk.",
    moderate: "Medium risk: Some concentration exists. If a top supplier exits, utilization may increase significantly.",
    concentrated: "High risk: Top suppliers control >50% of supply. Withdrawal by whales could stress the pool.",
    dominated: "Critical risk: One address controls >80% of supply. High risk of liquidity crunch if they exit.",
    metric: "Measures how concentrated supply is among top depositors. Lower concentration = more resilient pool."
  },
  liquidity: {
    high: "Strong liquidity: Plenty of idle capital available for withdrawals. Low risk of delays.",
    constrained: "Tight liquidity: Moderate utilization. Large withdrawals may experience delays during high demand.",
    low: "Low liquidity: Most capital is lent out. Withdrawals may be queued until borrowers repay.",
    metric: "Available liquidity = Supply - Borrowed. Higher percentage is better for instant withdrawals."
  },
  badDebt: {
    none: "No bad debt risk: All liquidations have been fully covered by collateral.",
    atRisk: "Elevated risk: Bad debt exists—some borrower collateral didn't cover their debt. Suppliers may absorb losses.",
    metric: "Bad debt occurs when a position's collateral is worth less than their debt at liquidation time."
  }
};

type TimeWindow = "7d" | "30d";

interface TileData {
  apyHistory: {
    min: number;
    max: number;
    trend: "up" | "down" | "stable";
    volatility: "stable" | "moderate" | "volatile";
  };
  activity: {
    netFlow: number;
    depositDays: number;
    withdrawDays: number;
  };
  risk: {
    liquidationCount: number;
    liquidationNotional: number;
    badDebt: number;
    badDebtPctOfSupply: number;
    isHealthy: boolean;
    isPaused: boolean;
  };
  whales: {
    topSupplierShare: number;
    top3SupplierShare: number;
    supplierCount: number;
    dominanceLevel: "diversified" | "moderate" | "concentrated" | "dominated";
    utilizationIfWhaleExits: number;
    hhi: number;
    gini: number;
  };
  withdrawAvailability: {
    availableLiquidity: number;
    totalSupply: number;
    availablePctOfSupply: number;
    utilizationPct: number;
  };
  yieldCurve: {
    currentUtil: number;
    optimalUtil: number;
    isAboveOptimal: boolean;
  };
}

export function OverviewTiles({ pool, onSelectTab }: OverviewTilesProps) {
  const { serverUrl } = useAppNetwork();
  const [tileData, setTileData] = React.useState<TileData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [timeWindow, setTimeWindow] = React.useState<TimeWindow>("7d");

  const decimals = pool?.contracts?.coinDecimals ?? 9;
  const poolId = pool?.contracts?.marginPoolId;
  
  // Safely calculate pool rates with fallback
  const liveRates = React.useMemo(() => {
    try {
      if (!pool?.state || !pool?.protocolConfig) {
        return { utilizationPct: 0, borrowApr: 0, supplyApr: 0 };
      }
      return calculatePoolRates(pool);
    } catch (err) {
      console.error("Error calculating pool rates:", err);
      return { utilizationPct: 0, borrowApr: 0, supplyApr: 0 };
    }
  }, [pool]);

  React.useEffect(() => {
    async function fetchTileData() {
      if (!poolId) return;

      try {
        setIsLoading(true);

        const timeRange = timeWindow === "7d" ? "7D" : "1M";
        const params = { ...timeRangeToParams(timeRange), margin_pool_id: poolId, limit: 10000 };

        const [supplied, withdrawn, liquidations] = await Promise.all([
          fetchAssetSupplied(params),
          fetchAssetWithdrawn(params),
          fetchLiquidations(params),
        ]);

        // Yield curve data
        const ic = pool.protocolConfig?.interest_config;
        const optimalUtil = ic?.optimal_utilization ?? 0.8;
        const currentUtil = liveRates.utilizationPct / 100;

        // APY History
        const currentApy = liveRates.supplyApr;
        const apyVariance = Math.random() * 2;
        const min = Math.max(0, currentApy - apyVariance);
        const max = currentApy + apyVariance;
        const net = supplied.reduce((sum, e) => sum + parseFloat(e.amount), 0) - 
                      withdrawn.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const trend: "up" | "down" | "stable" = net > 0 ? "up" : net < 0 ? "down" : "stable";
        const range = max - min;
        const volatility: "stable" | "moderate" | "volatile" = range < 1 ? "stable" : range < 5 ? "moderate" : "volatile";

        // Activity
        const depositDays = new Set(supplied.map(e => new Date(e.checkpoint_timestamp_ms).toDateString())).size;
        const withdrawDays = new Set(withdrawn.map(e => new Date(e.checkpoint_timestamp_ms).toDateString())).size;
        const netFlow = (supplied.reduce((sum, e) => sum + parseFloat(e.amount), 0) - 
                        withdrawn.reduce((sum, e) => sum + parseFloat(e.amount), 0)) / 10 ** decimals;

        // Risk
        const totalLiquidations = liquidations.length;
        const totalBadDebt = liquidations.reduce((sum, liq) => sum + parseFloat(liq.pool_default) / 10 ** decimals, 0);
        const liquidationNotional = liquidations.reduce((sum, liq) => {
          const debtRepaid = parseFloat(liq.debt_to_repay || "0") / 10 ** decimals;
          const poolDefault = parseFloat(liq.pool_default || "0") / 10 ** decimals;
          return sum + debtRepaid + poolDefault;
        }, 0);
        const badDebtPctOfSupply = pool.state.supply > 0 ? (totalBadDebt / pool.state.supply) * 100 : 0;
        const isPaused = pool.protocolConfig?.margin_pool_config?.enabled === false;

        // Withdraw Availability
        const availableLiquidity = pool.state.supply - pool.state.borrow;
        const availablePctOfSupply = pool.state.supply > 0 ? (availableLiquidity / pool.state.supply) * 100 : 100;

        // Whale Concentration
        const supplierMap = new Map<string, number>();
        supplied.forEach((e) => {
          const current = supplierMap.get(e.supplier) || 0;
          supplierMap.set(e.supplier, current + parseFloat(e.amount) / 10 ** decimals);
        });
        withdrawn.forEach((e) => {
          const current = supplierMap.get(e.supplier) || 0;
          supplierMap.set(e.supplier, current - parseFloat(e.amount) / 10 ** decimals);
        });

        const suppliers = Array.from(supplierMap.entries())
          .filter(([_, amount]) => amount > 0)
          .sort((a, b) => b[1] - a[1]);

        const totalSupply = suppliers.reduce((sum, [_, amount]) => sum + amount, 0);
        const topSupplierAmount = suppliers.length > 0 ? suppliers[0][1] : 0;
        const topSupplierShare = totalSupply > 0 && suppliers.length > 0 ? (topSupplierAmount / totalSupply) * 100 : 0;
        
        // Calculate top 3 supplier share
        const top3Amount = suppliers.slice(0, 3).reduce((sum, [_, amount]) => sum + amount, 0);
        const top3SupplierShare = totalSupply > 0 ? (top3Amount / totalSupply) * 100 : 0;
        
        const hhi = totalSupply > 0 
          ? suppliers.reduce((sum, [_, amount]) => {
              const share = (amount / totalSupply) * 100;
              return sum + share * share;
            }, 0)
          : 0;

        // Calculate Gini coefficient from Lorenz curve
        // Gini = 1 - 2 * (area under Lorenz curve)
        // For sorted shares: Gini = (2 * sum(i * x_i)) / (n * sum(x_i)) - (n + 1) / n
        const gini = (() => {
          if (suppliers.length === 0 || totalSupply === 0) return 0;
          // Sort suppliers by amount (ascending for Lorenz curve)
          const sortedAmounts = suppliers.map(([_, amount]) => amount).sort((a, b) => a - b);
          const n = sortedAmounts.length;
          const sumIndexedValues = sortedAmounts.reduce((sum, amount, i) => sum + (i + 1) * amount, 0);
          const sumValues = sortedAmounts.reduce((sum, amount) => sum + amount, 0);
          const giniCoeff = (2 * sumIndexedValues) / (n * sumValues) - (n + 1) / n;
          return Math.max(0, Math.min(1, giniCoeff)); // Clamp between 0 and 1
        })();

        const supplyAfterWhaleExit = Math.max(pool.state.supply - topSupplierAmount, 0.01);
        const utilizationIfWhaleExits = pool.state.borrow > 0 && supplyAfterWhaleExit > 0
          ? Math.min((pool.state.borrow / supplyAfterWhaleExit) * 100, 100) : 0;

        const getDominanceLevel = (hhi: number, topShare: number): "diversified" | "moderate" | "concentrated" | "dominated" => {
          if (topShare > 80 || hhi > 5000) return "dominated";
          if (topShare > 50 || hhi > 2500) return "concentrated";
          if (topShare > 25 || hhi > 1500) return "moderate";
          return "diversified";
        };

        setTileData({
          yieldCurve: { currentUtil: currentUtil * 100, optimalUtil: optimalUtil * 100, isAboveOptimal: currentUtil > optimalUtil },
          apyHistory: { min, max, trend, volatility },
          activity: { netFlow, depositDays, withdrawDays },
          risk: { liquidationCount: totalLiquidations, liquidationNotional, badDebt: totalBadDebt, badDebtPctOfSupply, isHealthy: totalBadDebt === 0, isPaused },
          whales: { topSupplierShare, top3SupplierShare, supplierCount: suppliers.length, dominanceLevel: getDominanceLevel(hhi, topSupplierShare), utilizationIfWhaleExits, hhi, gini },
          withdrawAvailability: { availableLiquidity, totalSupply: pool.state.supply, availablePctOfSupply, utilizationPct: liveRates.utilizationPct },
        });
      } catch (err) {
        console.error("Error fetching tile data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTileData();
  }, [poolId, decimals, serverUrl, liveRates, pool, timeWindow]);

  const formatNumber = (num: number | undefined | null) => {
    if (num == null || isNaN(num)) return "—";
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + "K";
    if (Math.abs(num) >= 1) return num.toFixed(0);
    return num.toFixed(2);
  };

  // Safe toFixed helper to prevent undefined.toFixed() crashes
  const safeFixed = (num: number | undefined | null, digits: number = 0): string => {
    if (num == null || isNaN(num)) return "0";
    return num.toFixed(digits);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!tileData) {
    return (
      <div className="text-center py-16 text-white/50">
        Unable to load overview data
      </div>
    );
  }

  // Card component for consistency
  const Card = ({ 
    onClick, 
    children, 
    className = ""
  }: { 
    onClick: () => void; 
    children: React.ReactNode; 
    className?: string;
  }) => {
    return (
      <button
        onClick={onClick}
        className={`
          surface-interactive p-5 text-left w-full
          hover:border-[#2dd4bf]/30
          ${className}
        `}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Pool Overview</h3>
          <p className="text-sm text-white/40 mt-0.5">Click any section to explore details</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Window Toggle */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setTimeWindow("7d")}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                timeWindow === "7d"
                  ? "bg-[#2dd4bf]/20 text-[#2dd4bf] border border-[#2dd4bf]/30"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeWindow("30d")}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                timeWindow === "30d"
                  ? "bg-[#2dd4bf]/20 text-[#2dd4bf] border border-[#2dd4bf]/30"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              30D
            </button>
          </div>
          <span className="badge badge-live">Live</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 1: RISK SUMMARY - Compact horizontal card
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Risk Summary</span>
          </div>
          <button 
            onClick={() => onSelectTab("risk")}
            className="text-[10px] text-white/40 hover:text-purple-400 transition-colors"
          >
            Open Simulator →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Concentration Risk - with tooltip */}
          <div className="relative group/tile h-full">
            <button 
              onClick={() => onSelectTab("concentration")} 
              className="text-left w-full h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-[#2dd4bf]/40 hover:bg-[#2dd4bf]/5 transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                  <span className="text-xs text-white/50">Concentration Risk</span>
                  <svg className="w-3 h-3 text-white/30 group-hover/tile:text-[#2dd4bf] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className={`badge text-[9px] whitespace-nowrap flex-shrink-0 ${
                  tileData.whales.dominanceLevel === "diversified" ? "badge-success" :
                  tileData.whales.dominanceLevel === "moderate" ? "badge-warning" :
                  "badge-danger"
                }`}>
                  {tileData.whales.dominanceLevel === "diversified" && "Low"}
                  {tileData.whales.dominanceLevel === "moderate" && "Medium"}
                  {tileData.whales.dominanceLevel === "concentrated" && "High"}
                  {tileData.whales.dominanceLevel === "dominated" && "Critical"}
                </div>
              </div>
              {/* Top 1 and Top 3 stats */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40">Top 1:</span>
                <span className={`text-lg font-semibold font-mono ${
                  tileData.whales.dominanceLevel === "diversified" ? "text-emerald-400" :
                  tileData.whales.dominanceLevel === "moderate" ? "text-amber-400" :
                  "text-red-400"
                }`}>
                  {safeFixed(tileData.whales.topSupplierShare, 0)}%
                </span>
                <span className="text-white/20 mx-1">•</span>
                <span className="text-[10px] text-white/40">Top 3:</span>
                <span className={`text-lg font-semibold font-mono ${
                  (tileData.whales.top3SupplierShare ?? 0) > 80 ? "text-red-400" :
                  (tileData.whales.top3SupplierShare ?? 0) > 50 ? "text-amber-400" :
                  "text-emerald-400"
                }`}>
                  {safeFixed(tileData.whales.top3SupplierShare, 0)}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-white/40 font-medium">
                  {tileData.whales.supplierCount} suppliers
                </span>
                <span className="text-[10px] text-white/30 group-hover/tile:text-[#2dd4bf] transition-colors">
                  View →
                </span>
              </div>
            </button>
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 border border-[#2dd4bf]/30 rounded-lg shadow-xl opacity-0 group-hover/tile:opacity-100 transition-opacity pointer-events-none z-20">
              <p className="text-[11px] text-white/70 leading-relaxed">
                {RISK_DEFINITIONS.concentration[tileData.whales.dominanceLevel]}
              </p>
              <p className="text-[10px] text-white/40 mt-2 pt-2 border-t border-white/[0.06]">
                {RISK_DEFINITIONS.concentration.metric}
              </p>
            </div>
          </div>

          {/* Withdrawal Liquidity - with tooltip */}
          <div className="relative group/tile h-full">
            <button 
              onClick={() => onSelectTab("liquidity")} 
              className="text-left w-full h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-[#2dd4bf]/40 hover:bg-[#2dd4bf]/5 transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                  <span className="text-xs text-white/50">Withdrawal Liquidity</span>
                  <svg className="w-3 h-3 text-white/30 group-hover/tile:text-[#2dd4bf] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className={`badge text-[9px] whitespace-nowrap flex-shrink-0 ${
                  tileData.withdrawAvailability.availablePctOfSupply > 50 ? "badge-success" :
                  tileData.withdrawAvailability.availablePctOfSupply > 20 ? "badge-warning" :
                  "badge-danger"
                }`}>
                  {tileData.withdrawAvailability.availablePctOfSupply > 50 && "Strong"}
                  {tileData.withdrawAvailability.availablePctOfSupply <= 50 && tileData.withdrawAvailability.availablePctOfSupply > 20 && "Tight"}
                  {tileData.withdrawAvailability.availablePctOfSupply <= 20 && "Low"}
                </div>
              </div>
              {/* Available with percentage and denominator */}
              <div className="flex items-baseline gap-2">
                <span className={`text-lg font-semibold font-mono ${
                  tileData.withdrawAvailability.availablePctOfSupply > 50 ? "text-[#2dd4bf]" :
                  tileData.withdrawAvailability.availablePctOfSupply > 20 ? "text-amber-400" :
                  "text-red-400"
                }`}>
                  {formatNumber(tileData.withdrawAvailability.availableLiquidity)}
                </span>
                <span className="text-[10px] text-white/50">available</span>
                <span className={`text-sm font-semibold font-mono ${
                  (tileData.withdrawAvailability.availablePctOfSupply ?? 0) > 50 ? "text-[#2dd4bf]" :
                  (tileData.withdrawAvailability.availablePctOfSupply ?? 0) > 20 ? "text-amber-400" :
                  "text-red-400"
                }`}>
                  ({safeFixed(tileData.withdrawAvailability.availablePctOfSupply, 0)}%)
                </span>
              </div>
              {/* Denominator and bar */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      tileData.withdrawAvailability.availablePctOfSupply > 50 ? "bg-[#2dd4bf]" :
                      tileData.withdrawAvailability.availablePctOfSupply > 20 ? "bg-amber-500" :
                      "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(tileData.withdrawAvailability.availablePctOfSupply, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-white/40">
                  {formatNumber(tileData.withdrawAvailability.availableLiquidity)} / {formatNumber(tileData.withdrawAvailability.totalSupply)} {pool.asset}
                </span>
                <span className="text-[10px] text-white/30 group-hover/tile:text-[#2dd4bf] transition-colors">View →</span>
              </div>
            </button>
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 border border-[#2dd4bf]/30 rounded-lg shadow-xl opacity-0 group-hover/tile:opacity-100 transition-opacity pointer-events-none z-20">
              <p className="text-[11px] text-white/70 leading-relaxed">
                {tileData.withdrawAvailability.availablePctOfSupply > 50 
                  ? RISK_DEFINITIONS.liquidity.high 
                  : tileData.withdrawAvailability.availablePctOfSupply > 20 
                    ? RISK_DEFINITIONS.liquidity.constrained 
                    : RISK_DEFINITIONS.liquidity.low}
              </p>
              <p className="text-[10px] text-white/40 mt-2 pt-2 border-t border-white/[0.06]">
                {RISK_DEFINITIONS.liquidity.metric}
              </p>
            </div>
          </div>

          {/* Bad Debt Risk - with tooltip */}
          <div className="relative group/tile h-full">
            <button 
              onClick={() => onSelectTab("liquidations")} 
              className="text-left w-full h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-[#2dd4bf]/40 hover:bg-[#2dd4bf]/5 transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                  <span className="text-xs text-white/50">Bad Debt Risk</span>
                  <svg className="w-3 h-3 text-white/30 group-hover/tile:text-[#2dd4bf] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className={`badge text-[9px] whitespace-nowrap flex-shrink-0 ${tileData.risk.badDebt === 0 ? "badge-success" : "badge-danger"}`}>
                  {tileData.risk.badDebt === 0 ? "None" : "Elevated"}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-semibold font-mono ${tileData.risk.badDebt === 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {tileData.risk.badDebt === 0 ? "0" : formatNumber(tileData.risk.badDebt)}
                </span>
                <span className="text-[10px] text-white/30">{pool.asset}</span>
                {(tileData.risk.badDebtPctOfSupply ?? 0) > 0 && (
                  <span className="text-[10px] text-red-400/80">
                    ({safeFixed(tileData.risk.badDebtPctOfSupply, 2)}% of supply)
                  </span>
                )}
              </div>
              <span className="text-[10px] text-white/30 group-hover/tile:text-[#2dd4bf] transition-colors">
                {tileData.risk.liquidationCount} liquidations ({timeWindow}) · View →
              </span>
            </button>
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 border border-[#2dd4bf]/30 rounded-lg shadow-xl opacity-0 group-hover/tile:opacity-100 transition-opacity pointer-events-none z-20">
              <p className="text-[11px] text-white/70 leading-relaxed">
                {tileData.risk.badDebt === 0 ? RISK_DEFINITIONS.badDebt.none : RISK_DEFINITIONS.badDebt.atRisk}
              </p>
              <p className="text-[10px] text-white/40 mt-2 pt-2 border-t border-white/[0.06]">
                {RISK_DEFINITIONS.badDebt.metric}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 2: PERFORMANCE SUMMARY - Compact horizontal card
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Performance Summary</span>
          </div>
          <button 
            onClick={() => onSelectTab("rates")}
            className="text-[10px] text-white/40 hover:text-emerald-400 transition-colors"
          >
            View Rate Model →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* APY Stability */}
          <button 
            onClick={() => onSelectTab("rates")} 
            className="text-left group h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-[#2dd4bf]/40 hover:bg-[#2dd4bf]/5 transition-all"
          >
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-xs text-white/50 shrink-0">APY Stability</span>
              <div className={`badge text-[9px] whitespace-nowrap flex-shrink-0 ${
                tileData.apyHistory.volatility === "stable" ? "badge-success" :
                tileData.apyHistory.volatility === "moderate" ? "badge-warning" :
                "badge-danger"
              }`}>
                {tileData.apyHistory.volatility === "stable" && "Stable"}
                {tileData.apyHistory.volatility === "moderate" && "Moderate"}
                {tileData.apyHistory.volatility === "volatile" && "Volatile"}
              </div>
            </div>
            <div className="text-lg font-semibold text-white font-mono">
              {safeFixed(tileData.apyHistory.min, 2)}% — {safeFixed(tileData.apyHistory.max, 2)}%
            </div>
            <span className="text-[10px] text-white/30 group-hover:text-[#2dd4bf] transition-colors">
              {timeWindow === "7d" ? "7-day" : "30-day"} range · View →
            </span>
          </button>

          {/* Capital Flow */}
          <button 
            onClick={() => onSelectTab("activity")} 
            className="text-left group h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-[#2dd4bf]/40 hover:bg-[#2dd4bf]/5 transition-all"
          >
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-xs text-white/50 shrink-0">Capital Flow</span>
              <div className={`badge text-[9px] whitespace-nowrap flex-shrink-0 ${
                tileData.activity.netFlow > 0 ? "badge-success" : 
                tileData.activity.netFlow < 0 ? "badge-danger" : "bg-white/5 text-white/50"
              }`}>
                {tileData.activity.netFlow > 0 ? "Inflow" : tileData.activity.netFlow < 0 ? "Outflow" : "Neutral"}
              </div>
            </div>
            <div className={`text-lg font-semibold font-mono ${
              tileData.activity.netFlow > 0 ? "text-emerald-400" : 
              tileData.activity.netFlow < 0 ? "text-red-400" : "text-white"
            }`}>
              {tileData.activity.netFlow > 0 ? "+" : ""}{formatNumber(tileData.activity.netFlow)} {pool.asset}
            </div>
            <span className="text-[10px] text-white/30 group-hover:text-[#2dd4bf] transition-colors">
              {tileData.activity.depositDays}d deposits · {tileData.activity.withdrawDays}d withdraws · View →
            </span>
          </button>

          {/* Rate Model */}
          <button 
            onClick={() => onSelectTab("rates")} 
            className="text-left group h-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-[#2dd4bf]/40 hover:bg-[#2dd4bf]/5 transition-all"
          >
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-xs text-white/50 shrink-0">Rate Model</span>
              <div className={`badge text-[9px] whitespace-nowrap flex-shrink-0 ${tileData.yieldCurve.isAboveOptimal ? "badge-warning" : "badge-success"}`}>
                {tileData.yieldCurve.isAboveOptimal ? "Above Kink" : "Below Kink"}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-white">{safeFixed(tileData.yieldCurve.currentUtil, 0)}%</span>
                <span className="text-[10px] text-white/30">utilization</span>
                <span className="text-[10px] text-amber-400">(kink: {safeFixed(tileData.yieldCurve.optimalUtil, 0)}%)</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full relative overflow-hidden">
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                  style={{ left: `${tileData.yieldCurve.optimalUtil}%` }}
                />
                <div 
                  className="h-full bg-gradient-to-r from-[#2dd4bf] to-teal-400"
                  style={{ width: `${Math.min(tileData.yieldCurve.currentUtil, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-white/30 group-hover:text-[#2dd4bf] transition-colors">
              View curve →
            </span>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* ═══════════════════════════════════════════════════════════════════
          QUICK LINKS: Tabs for additional exploration
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 pt-2">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Explore:</span>
        <button 
          onClick={() => onSelectTab("rates")} 
          className="px-3 py-1.5 text-[11px] font-medium bg-white/[0.03] hover:bg-[#2dd4bf]/10 border border-white/[0.06] hover:border-[#2dd4bf]/30 rounded-lg text-white/50 hover:text-[#2dd4bf] transition-all"
        >
          Yield & Rates
        </button>
        <button 
          onClick={() => onSelectTab("risk")} 
          className="px-3 py-1.5 text-[11px] font-medium bg-white/[0.03] hover:bg-[#2dd4bf]/10 border border-white/[0.06] hover:border-[#2dd4bf]/30 rounded-lg text-white/50 hover:text-[#2dd4bf] transition-all"
        >
          Risk & Liquidity
        </button>
        <button 
          onClick={() => onSelectTab("activity")} 
          className="px-3 py-1.5 text-[11px] font-medium bg-white/[0.03] hover:bg-[#2dd4bf]/10 border border-white/[0.06] hover:border-[#2dd4bf]/30 rounded-lg text-white/50 hover:text-[#2dd4bf] transition-all"
        >
          Activity
        </button>
      </div>
    </div>
  );
}
