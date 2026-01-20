import type { FC } from "react";
import React, { useState, useMemo } from "react";
import type { UserPosition, PoolOverview } from "../types";
import { useEnrichedUserPositions } from "../../../hooks/useEnrichedUserPositions";
import { 
  ChevronRightIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

type Props = {
  userAddress: string | undefined;
  pools: PoolOverview[];
  positions?: UserPosition[];
  onViewAllHistory?: () => void;
  onSelectPool: (poolId: string) => void;
};

type RiskLevel = "low" | "medium" | "high";
type ViewMode = "holdings" | "projections";
type TimeFrame = "30d" | "1y";
type AmountBasis = "supplied" | "custom";
type ScenarioType = "low" | "base" | "high";

const MAX_VISIBLE_ROWS = 4;

function getRiskLevel(utilizationPct: number): RiskLevel {
  if (utilizationPct >= 80) return "high";
  if (utilizationPct >= 50) return "medium";
  return "low";
}

function getRiskBadgeStyles(risk: RiskLevel) {
  switch (risk) {
    case "high":
      return "bg-red-500/15 text-red-400 border-red-500/20";
    case "medium":
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "low":
    default:
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  }
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatEarnings(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  if (n === 0) return "0.00";
  return n.toFixed(4);
}

// Generate projection chart data
function generateProjectionData(
  principal: number,
  baseAPY: number,
  lowAPY: number,
  highAPY: number,
  timeframe: TimeFrame
) {
  const intervals = timeframe === "30d"
    ? [
        { day: 1, label: "1d" },
        { day: 7, label: "1w" },
        { day: 14, label: "2w" },
        { day: 30, label: "30d" },
      ]
    : [
        { day: 7, label: "1w" },
        { day: 30, label: "1m" },
        { day: 90, label: "3m" },
        { day: 180, label: "6m" },
        { day: 365, label: "1y" },
      ];

  return intervals.map(({ day, label }) => {
    const baseDailyRate = baseAPY / 100 / 365;
    const lowDailyRate = lowAPY / 100 / 365;
    const highDailyRate = highAPY / 100 / 365;

    const baseEarnings = principal * (Math.pow(1 + baseDailyRate, day) - 1);
    const lowEarnings = principal * (Math.pow(1 + lowDailyRate, day) - 1);
    const highEarnings = principal * (Math.pow(1 + highDailyRate, day) - 1);

    return { day, label, base: baseEarnings, low: lowEarnings, high: highEarnings };
  });
}

// Derive APY range from pool config (utilization-based bounds)
function getAPYRange(pool: PoolOverview): { low: number; base: number; high: number } {
  const base = pool.ui.aprSupplyPct;
  const ic = pool.protocolConfig?.interest_config;
  const mc = pool.protocolConfig?.margin_pool_config;

  if (!ic || !mc) {
    // Fallback: +/- 30% of base
    return { low: base * 0.5, base, high: base * 1.5 };
  }

  const optimalU = ic.optimal_utilization;
  const baseRate = ic.base_rate;
  const baseSlope = ic.base_slope;
  const spread = mc.protocol_spread;

  // High case: at optimal utilization
  const optimalBorrowAPY = baseRate + baseSlope * optimalU;
  const highAPY = Math.max(optimalBorrowAPY * optimalU * (1 - spread) * 100, base);

  // Low case: at 25% of optimal utilization
  const lowUtil = optimalU * 0.25;
  const lowBorrowAPY = baseRate + baseSlope * lowUtil;
  const lowAPY = Math.min(lowBorrowAPY * lowUtil * (1 - spread) * 100, base * 0.8);

  return { low: Math.max(lowAPY, 0), base, high: highAPY };
}

export const PortfolioCard: FC<Props> = ({
  userAddress,
  pools,
  positions = [],
  onViewAllHistory,
  onSelectPool,
}) => {
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("holdings");
  
  // Projections state
  const [selectedMarketId, setSelectedMarketId] = useState<string>("all");
  const [timeframe, setTimeframe] = useState<TimeFrame>("30d");
  const [amountBasis, setAmountBasis] = useState<AmountBasis>("supplied");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("base");

  const enrichedPositions = useEnrichedUserPositions(positions, pools);

  // Filter to only positions with a balance > 0
  const activePositions = useMemo(() => {
    return enrichedPositions.filter((p) => {
      const match = p.balanceFormatted.match(/^([\d.,]+)/);
      const balance = match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
      return balance > 0;
    });
  }, [enrichedPositions]);

  // Calculate portfolio totals
  const portfolioSummary = useMemo(() => {
    let totalSuppliedUSD = 0;
    let totalEarnedUSD = 0;
    let totalExitAvailable = 0;
    let totalExitPossible = 0;

    for (const position of activePositions) {
      const pool = pools.find((p) => p.asset === position.asset);
      if (!pool) continue;

      const match = position.balanceFormatted.match(/^([\d.,]+)/);
      const balance = match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
      
      const priceUSD = 1;
      totalSuppliedUSD += balance * priceUSD;

      if (position.interestEarned && position.interestEarned !== "—") {
        const earnedMatch = position.interestEarned.match(/^([\d.,]+)/);
        const earned = earnedMatch ? parseFloat(earnedMatch[1].replace(/,/g, "")) || 0 : 0;
        totalEarnedUSD += earned * priceUSD;
      }

      const availableLiquidity = pool.state.supply - pool.state.borrow;
      const canWithdraw = Math.min(availableLiquidity, balance);
      totalExitAvailable += canWithdraw * priceUSD;
      totalExitPossible += balance * priceUSD;
    }

    const exitPct = totalExitPossible > 0 
      ? Math.round((totalExitAvailable / totalExitPossible) * 100) 
      : 100;

    return { totalSupplied: totalSuppliedUSD, totalEarned: totalEarnedUSD, exitPct };
  }, [activePositions, pools]);

  // Calculate projections data
  const projectionsData = useMemo(() => {
    const positionsToCalc = selectedMarketId === "all" 
      ? activePositions 
      : activePositions.filter(p => {
          const pool = pools.find(pool => pool.asset === p.asset);
          return pool?.id === selectedMarketId;
        });

    let totalPrincipal = 0;
    let weightedBaseAPY = 0;
    let weightedLowAPY = 0;
    let weightedHighAPY = 0;

    const breakdown: Array<{ asset: string; projected: number }> = [];

    for (const position of positionsToCalc) {
      const pool = pools.find((p) => p.asset === position.asset);
      if (!pool) continue;

      const match = position.balanceFormatted.match(/^([\d.,]+)/);
      let balance = match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;

      // Use custom amount if in custom mode and single market
      if (amountBasis === "custom" && selectedMarketId !== "all" && customAmount) {
        balance = parseFloat(customAmount) || 0;
      }

      const { low, base, high } = getAPYRange(pool);
      
      totalPrincipal += balance;
      weightedBaseAPY += base * balance;
      weightedLowAPY += low * balance;
      weightedHighAPY += high * balance;

      // Calculate this position's projected earnings at base
      const days = timeframe === "30d" ? 30 : 365;
      const dailyRate = base / 100 / 365;
      const projected = balance * (Math.pow(1 + dailyRate, days) - 1);
      breakdown.push({ asset: pool.asset, projected });
    }

    if (totalPrincipal > 0) {
      weightedBaseAPY /= totalPrincipal;
      weightedLowAPY /= totalPrincipal;
      weightedHighAPY /= totalPrincipal;
    }

    // Generate chart data
    const chartData = generateProjectionData(
      totalPrincipal,
      weightedBaseAPY,
      weightedLowAPY,
      weightedHighAPY,
      timeframe
    );

    // Get final projections
    const lastPoint = chartData[chartData.length - 1] || { low: 0, base: 0, high: 0 };

    return {
      chartData,
      principal: totalPrincipal,
      baseAPY: weightedBaseAPY,
      lowAPY: weightedLowAPY,
      highAPY: weightedHighAPY,
      projectedLow: lastPoint.low,
      projectedBase: lastPoint.base,
      projectedHigh: lastPoint.high,
      breakdown,
    };
  }, [activePositions, pools, selectedMarketId, timeframe, amountBasis, customAmount]);

  // Which rows to show
  const visiblePositions = showAllPositions 
    ? activePositions 
    : activePositions.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = activePositions.length - MAX_VISIBLE_ROWS;

  // Handler for row click - switch pool AND jump to projections
  const handleRowClick = (poolId: string) => {
    onSelectPool(poolId);
  };

  // Handler for calc icon - jump to projections with that market
  const handleCalcClick = (poolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMarketId(poolId);
    setViewMode("projections");
  };

  // Scenario colors
  const scenarioColors = {
    low: "#6366f1",
    base: "#2dd4bf",
    high: "#10b981",
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      if (!dataPoint) return null;
      
      return (
        <div className="bg-[#0a1419]/98 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-2.5 shadow-2xl">
          <p className="text-[10px] text-white/40 mb-1 font-medium tracking-wide uppercase">
            Earnings at {label}
          </p>
          <p className="text-[9px] text-white/30 mb-2">
            APY: <span className="text-indigo-400">Low {projectionsData.lowAPY.toFixed(2)}%</span>
            <span className="mx-1">·</span>
            <span className="text-[#2dd4bf]">Base {projectionsData.baseAPY.toFixed(2)}%</span>
            <span className="mx-1">·</span>
            <span className="text-emerald-400">High {projectionsData.highAPY.toFixed(2)}%</span>
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] text-white/50">High APY</span>
              <span className="text-xs font-mono text-emerald-400">${formatEarnings(dataPoint.high)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] text-white/50">Base APY</span>
              <span className="text-xs font-mono text-[#2dd4bf]">${formatEarnings(dataPoint.base)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] text-white/50">Low APY</span>
              <span className="text-xs font-mono text-indigo-400">${formatEarnings(dataPoint.low)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // If no wallet connected
  if (!userAddress) {
    return (
      <div className="surface-elevated p-4">
        <div className="text-xs text-white/40 text-center">
          Connect wallet to view your portfolio
        </div>
      </div>
    );
  }

  // If no positions
  if (activePositions.length === 0) {
    return (
      <div className="surface-elevated p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <h3 className="text-sm font-medium text-white/60">Your portfolio</h3>
        </div>
        <div className="text-xs text-white/40">
          No positions yet. Deposit to start earning.
        </div>
      </div>
    );
  }

  return (
    <div className="surface-elevated overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf]" />
            <h3 className="text-sm font-medium text-white">
              Your positions{" "}
              <span className="text-white/50">({activePositions.length})</span>
            </h3>
          </div>
          {onViewAllHistory && (
            <button
              onClick={onViewAllHistory}
              className="text-[10px] text-[#2dd4bf] hover:text-[#5eead4] transition-colors font-medium"
            >
              View all →
            </button>
          )}
        </div>

        {/* One-line Summary */}
        <div className="flex items-center gap-3 text-xs mb-3">
          <span className="text-white/70">
            Total{" "}
            <span className="font-mono font-medium text-white">
              {formatCompactNumber(portfolioSummary.totalSupplied)}
            </span>
          </span>
          <span className="text-white/30">·</span>
          <span className="text-white/70">
            Earned{" "}
            <span className="font-mono font-medium text-emerald-400">
              {formatCompactNumber(portfolioSummary.totalEarned)}
            </span>
          </span>
          <span className="text-white/30">·</span>
          <span className="text-white/70">
            Exit{" "}
            <span className={`font-medium ${portfolioSummary.exitPct >= 100 ? "text-emerald-400" : portfolioSummary.exitPct >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {portfolioSummary.exitPct}%
            </span>
            {" "}available
          </span>
        </div>

        {/* Segmented Control */}
        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("holdings")}
            className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
              viewMode === "holdings"
                ? "bg-[#2dd4bf]/20 text-[#2dd4bf]"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            Holdings
          </button>
          <button
            onClick={() => setViewMode("projections")}
            className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
              viewMode === "projections"
                ? "bg-[#2dd4bf]/20 text-[#2dd4bf]"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            Projections
          </button>
        </div>
      </div>

      {/* Holdings View - Simplified rows, no expand */}
      {viewMode === "holdings" && (
        <>
          <div className="divide-y divide-white/[0.04]">
            {visiblePositions.map((position, index) => {
              const pool = pools.find((p) => p.asset === position.asset);
              if (!pool) return null;

              const rowKey = `${position.supplierCapId}-${index}`;
              
              // Parse balance
              const match = position.balanceFormatted.match(/^([\d.,]+)/);
              const balance = match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
              
              // Calculate exit availability
              const availableLiquidity = pool.state.supply - pool.state.borrow;
              const exitPct = balance > 0 
                ? Math.min((availableLiquidity / balance) * 100, 100) 
                : 100;
              
              // Utilization for risk badge
              const utilizationPct = pool.state.supply > 0 
                ? (pool.state.borrow / pool.state.supply) * 100 
                : 0;
              const riskLevel = getRiskLevel(utilizationPct);

              return (
                <div 
                  key={rowKey} 
                  onClick={() => handleRowClick(pool.id)}
                  className="px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    {/* Left: Icon + Pool Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={pool.ui.iconUrl || "https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png"}
                        alt={pool.asset}
                        className="w-6 h-6 rounded-full flex-shrink-0 group-hover:scale-105 transition-transform"
                      />
                      <span className="text-sm font-medium text-white truncate group-hover:text-[#2dd4bf] transition-colors">
                        {pool.asset} Margin Pool
                      </span>
                    </div>

                    {/* Right: Balance + Chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-mono font-medium text-white">
                        {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pool.asset}
                      </span>
                      <ChevronRightIcon className="w-4 h-4 text-white/30 group-hover:text-[#2dd4bf] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Subline - compact stats */}
                  <div className="flex items-center gap-2 mt-1.5 ml-[34px]">
                    {/* APY */}
                    <span className="text-[10px] font-mono text-emerald-400/80">
                      {pool.ui.aprSupplyPct.toFixed(2)}% APY
                    </span>
                    <span className="text-white/20">·</span>
                    
                    {/* Exit bar */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/40">Exit</span>
                      <div className="w-10 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            exitPct >= 100 ? "bg-emerald-400" : exitPct >= 50 ? "bg-amber-400" : "bg-red-400"
                          }`}
                          style={{ width: `${Math.min(exitPct, 100)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono ${
                        exitPct >= 100 ? "text-emerald-400" : exitPct >= 50 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {exitPct.toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-white/20">·</span>
                    
                    {/* Risk Badge */}
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getRiskBadgeStyles(riskLevel)}`}>
                      {riskLevel}
                    </span>

                    {/* Calc shortcut - appears on hover */}
                    <button
                      onClick={(e) => handleCalcClick(pool.id, e)}
                      className="ml-auto text-[10px] text-white/0 group-hover:text-white/40 hover:!text-[#2dd4bf] transition-colors"
                      title="View projections"
                    >
                      Calc →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show More / Show Less */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllPositions(!showAllPositions)}
              className="w-full py-2.5 text-[11px] text-[#2dd4bf] hover:text-[#5eead4] transition-colors text-center border-t border-white/[0.06] hover:bg-white/[0.02]"
            >
              {showAllPositions ? "Show less" : `+ ${hiddenCount} more position${hiddenCount > 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}

      {/* Projections View - Chart + Range */}
      {viewMode === "projections" && (
        <div className="p-4 space-y-4 animate-fade-in">
          {/* Controls Row */}
          <div className="flex items-center gap-3">
            {/* Market Dropdown */}
            <div className="flex-shrink-0">
              <select
                value={selectedMarketId}
                onChange={(e) => setSelectedMarketId(e.target.value)}
                className="bg-[#1a1f2e] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#2dd4bf]/50 appearance-none cursor-pointer pr-7"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.875rem' }}
              >
                <option value="all" className="bg-[#1a1f2e] text-white">All positions</option>
                {activePositions.map((pos) => {
                  const pool = pools.find(p => p.asset === pos.asset);
                  return pool ? (
                    <option key={pool.id} value={pool.id} className="bg-[#1a1f2e] text-white">
                      {pool.asset} Pool
                    </option>
                  ) : null;
                })}
              </select>
            </div>

            {/* APY Range Pill */}
            <div className="flex-1 flex items-center gap-2">
              <div className="group relative flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] rounded-md border border-white/[0.06]">
                <span className="text-[9px] text-white/40 uppercase tracking-wide">APY</span>
                <span className="text-[10px] font-mono text-white/70">
                  {projectionsData.lowAPY.toFixed(2)}% – {projectionsData.highAPY.toFixed(2)}%
                </span>
                <InformationCircleIcon className="w-3 h-3 text-white/30" />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#0a1419] border border-white/[0.1] rounded text-[9px] text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Range from recent history / utilization
                </div>
              </div>
              {/* High is rare warning */}
              {projectionsData.highAPY > projectionsData.baseAPY * 10 && (
                <div className="group relative flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                  <span className="text-[8px] text-amber-400/80 uppercase tracking-wide">High is rare</span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#0a1419] border border-white/[0.1] rounded text-[9px] text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    High reflects short spikes; not sustained
                  </div>
                </div>
              )}
            </div>

            {/* Timeframe Toggle */}
            <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
              {(["30d", "1y"] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all uppercase ${
                    timeframe === tf
                      ? "bg-[#2dd4bf]/20 text-[#2dd4bf]"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Basis Toggle - only for single market */}
          {selectedMarketId !== "all" && (
            <div className="space-y-2">
              <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
                <button
                  onClick={() => setAmountBasis("supplied")}
                  className={`flex-1 px-3 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                    amountBasis === "supplied"
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  Use my supplied
                </button>
                <button
                  onClick={() => setAmountBasis("custom")}
                  className={`flex-1 px-3 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                    amountBasis === "custom"
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  Custom amount
                </button>
              </div>
              {amountBasis === "custom" && (
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#2dd4bf]/50"
                />
              )}
            </div>
          )}

          {/* Chart - Main visual */}
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-3">
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionsData.chartData} margin={{ top: 8, right: 8, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="projRangeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="projBaseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={scenarioColors[selectedScenario]} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={scenarioColors[selectedScenario]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v >= 1 ? v.toFixed(0) : v.toFixed(2)}`}
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  
                  {/* Range band (low to high) */}
                  <Area
                    type="monotone"
                    dataKey="high"
                    stroke="transparent"
                    fill="url(#projRangeGradient)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="low"
                    stroke="transparent"
                    fill="#0d1a1f"
                    isAnimationActive={false}
                  />
                  
                  {/* Low line (dashed) */}
                  <Area
                    type="monotone"
                    dataKey="low"
                    stroke={scenarioColors.low}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  
                  {/* High line (dashed) */}
                  <Area
                    type="monotone"
                    dataKey="high"
                    stroke={scenarioColors.high}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  
                  {/* Base line (solid) */}
                  <Area
                    type="monotone"
                    dataKey="base"
                    stroke={scenarioColors.base}
                    strokeWidth={2}
                    fill="url(#projBaseGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Chart legend */}
            <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-white/[0.04]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-indigo-400 rounded opacity-60" style={{ borderStyle: 'dashed' }} />
                <span className="text-[9px] text-white/40">Low APY</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-[#2dd4bf] rounded" />
                <span className="text-[9px] text-white/40">Base APY</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-emerald-400 rounded opacity-60" style={{ borderStyle: 'dashed' }} />
                <span className="text-[9px] text-white/40">High APY</span>
              </div>
            </div>
          </div>

          {/* Range Summary */}
          <div className="space-y-2">
            {/* Main range */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#2dd4bf]/10 to-transparent rounded-lg border border-[#2dd4bf]/20">
              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">
                  Projected ({timeframe})
                </div>
                <div className="text-lg font-bold font-mono text-white">
                  ${formatEarnings(projectionsData.projectedLow)} – ${formatEarnings(projectionsData.projectedHigh)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/40">Base case</div>
                <div className="text-sm font-mono text-[#2dd4bf]">
                  ${formatEarnings(projectionsData.projectedBase)}
                </div>
                <div className="text-[9px] text-white/30">
                  <span className="text-indigo-400/60">{projectionsData.lowAPY.toFixed(2)}%</span>
                  <span className="mx-0.5">·</span>
                  <span className="text-[#2dd4bf]/80">{projectionsData.baseAPY.toFixed(2)}%</span>
                  <span className="mx-0.5">·</span>
                  <span className="text-emerald-400/60">{projectionsData.highAPY.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Scenario chips */}
            <div className="flex items-center gap-1">
              {(["low", "base", "high"] as ScenarioType[]).map((scenario) => (
                <button
                  key={scenario}
                  onClick={() => setSelectedScenario(scenario)}
                  className={`flex-1 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider rounded-lg border transition-all ${
                    selectedScenario === scenario
                      ? scenario === "low"
                        ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                        : scenario === "base"
                        ? "bg-[#2dd4bf]/15 text-[#2dd4bf] border-[#2dd4bf]/30"
                        : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-white/[0.02] text-white/40 border-white/[0.06] hover:text-white/60"
                  }`}
                >
                  {scenario}
                  <span className="ml-1 opacity-60">
                    ${formatEarnings(
                      scenario === "low" ? projectionsData.projectedLow :
                      scenario === "base" ? projectionsData.projectedBase :
                      projectionsData.projectedHigh
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Breakdown for "All positions" */}
            {selectedMarketId === "all" && projectionsData.breakdown.length > 1 && (
              <div className="text-center text-[10px] text-white/50">
                {projectionsData.breakdown.map((b, i) => (
                  <span key={b.asset}>
                    {i > 0 && <span className="mx-1.5">·</span>}
                    <span className="text-white/70">{b.asset}</span>{" "}
                    <span className="font-mono">${formatEarnings(b.projected)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-1.5 text-[9px] text-white/30">
            <InformationCircleIcon className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              Based on recent APY range. Earnings are variable and depend on pool utilization.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioCard;
