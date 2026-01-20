import type { FC } from "react";
import React, { useState, useMemo, useEffect } from "react";
import type { UserPosition, PoolOverview } from "../types";
import { useUserPositions } from "../../../hooks/useUserPositions";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import { useEnrichedUserPositions } from "../../../hooks/useEnrichedUserPositions";
import { useUserActivity } from "../hooks/useUserActivity";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { ChevronDownIcon, ChevronUpIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

type ScenarioType = "low" | "base" | "high";

type Props = {
  userAddress: string | undefined;
  pools: PoolOverview[];
  selectedPool: PoolOverview | null;
  positions?: UserPosition[];
  pendingDepositAmount?: string;
  onViewAllHistory?: () => void;
};

function generateProjectionData(
  depositAmount: number,
  existingPosition: number,
  currentAPY: number,
  lowAPY: number,
  highAPY: number,
  period: "30d" | "1y" = "30d"
) {
  const dataPoints: {
    day: number;
    label: string;
    current: number;
    low: number;
    high: number;
  }[] = [];

  const totalAmount = depositAmount + existingPosition;
  
  const intervals = period === "30d" 
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

  for (const { day, label } of intervals) {
    const currentDailyRate = currentAPY / 100 / 365;
    const lowDailyRate = lowAPY / 100 / 365;
    const highDailyRate = highAPY / 100 / 365;

    const currentEarnings = totalAmount * (Math.pow(1 + currentDailyRate, day) - 1);
    const lowEarnings = totalAmount * (Math.pow(1 + lowDailyRate, day) - 1);
    const highEarnings = totalAmount * (Math.pow(1 + highDailyRate, day) - 1);

    dataPoints.push({ day, label, current: currentEarnings, low: lowEarnings, high: highEarnings });
  }

  return dataPoints;
}

export const PositionsWithCalculator: FC<Props> = ({
  userAddress,
  pools,
  selectedPool,
  positions: propPositions,
  pendingDepositAmount = "",
  onViewAllHistory,
}) => {
  const { explorerUrl, indexerStatus } = useAppNetwork();
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [manualAmount, setManualAmount] = useState<string>("");
  const [projectionPeriod, setProjectionPeriod] = useState<"30d" | "1y">("30d");
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("base");

  const { data: fetchedPositions, error, isLoading } = useUserPositions(propPositions ? undefined : userAddress);
  const positions = propPositions || fetchedPositions;
  const enrichedPositions = useEnrichedUserPositions(positions, pools);

  const supplierCapIds = useMemo(() => {
    return enrichedPositions.map((pos) => pos.supplierCapId).filter((id): id is string => !!id);
  }, [enrichedPositions]);

  const { transactions, isLoading: historyLoading } = useUserActivity(userAddress, undefined, undefined, supplierCapIds);

  const uniqueCapIds = useMemo(() => {
    const capIds = new Set(
      enrichedPositions.map((pos) => pos.supplierCapId).filter((id): id is string => id !== undefined)
    );
    return Array.from(capIds);
  }, [enrichedPositions]);

  const [selectedCapId, setSelectedCapId] = useState<string | null>(uniqueCapIds.length > 0 ? uniqueCapIds[0] : null);

  useEffect(() => {
    if (uniqueCapIds.length > 0 && (!selectedCapId || !uniqueCapIds.includes(selectedCapId))) {
      setSelectedCapId(uniqueCapIds[0]);
    } else if (uniqueCapIds.length === 0) {
      setSelectedCapId(null);
    }
  }, [uniqueCapIds, selectedCapId]);

  const filteredPositions = useMemo(() => {
    if (uniqueCapIds.length <= 1) return enrichedPositions;
    if (!selectedCapId) return [];
    return enrichedPositions.filter((pos) => pos.supplierCapId === selectedCapId);
  }, [enrichedPositions, selectedCapId, uniqueCapIds.length]);

  const currentPositionForPool = useMemo(() => {
    if (!selectedPool) return 0;
    const position = enrichedPositions.find((p) => p.asset === selectedPool.asset);
    if (!position) return 0;
    const match = position.balanceFormatted.match(/^([\d.,]+)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) || 0 : 0;
  }, [enrichedPositions, selectedPool]);

  const isWhatIfMode = pendingDepositAmount && parseFloat(pendingDepositAmount) > 0;
  const displayAmount = isWhatIfMode ? pendingDepositAmount : manualAmount;
  const depositAmount = parseFloat(displayAmount) || 0;

  const currentAPY = selectedPool?.ui?.aprSupplyPct ?? 0;
  const ic = selectedPool?.protocolConfig?.interest_config;
  const mc = selectedPool?.protocolConfig?.margin_pool_config;

  let optimisticAPY = currentAPY;
  let pessimisticAPY = currentAPY;
  let highUtilizationPct = 0;
  let lowUtilizationPct = 0;

  if (ic && mc) {
    const optimalU = ic.optimal_utilization;
    const baseRate = ic.base_rate;
    const baseSlope = ic.base_slope;
    const spread = mc.protocol_spread;

    // High: utilization at optimal level
    const optimalBorrowAPY = baseRate + baseSlope * optimalU;
    const calculatedOptimisticAPY = optimalBorrowAPY * optimalU * (1 - spread) * 100;

    // Low: utilization drops to 25% of optimal
    const lowUtil = optimalU * 0.25;
    const lowBorrowAPY = baseRate + baseSlope * lowUtil;
    const calculatedPessimisticAPY = lowBorrowAPY * lowUtil * (1 - spread) * 100;

    // Ensure high is always >= current and low is always <= current
    // This prevents the confusing case where "low" is higher than "current"
    optimisticAPY = Math.max(calculatedOptimisticAPY, currentAPY);
    // Low is min of calculated pessimistic OR current minus 20%
    pessimisticAPY = Math.min(calculatedPessimisticAPY, currentAPY * 0.8);

    // Store utilization percentages for display
    highUtilizationPct = optimalU * 100;
    lowUtilizationPct = lowUtil * 100;
  }

  const chartData = useMemo(
    () => generateProjectionData(depositAmount, currentPositionForPool, currentAPY, pessimisticAPY, optimisticAPY, projectionPeriod),
    [depositAmount, currentPositionForPool, currentAPY, pessimisticAPY, optimisticAPY, projectionPeriod]
  );

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(chartData.length > 0);
  const gradientId = useStableGradientId('projectionGradient');

  const totalAmount = depositAmount + currentPositionForPool;

  const formatEarnings = (num: number) => {
    if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (num >= 1) return num.toFixed(2);
    if (num >= 0.01) return num.toFixed(4);
    if (num >= 0.0001) return num.toFixed(6);
    if (num === 0) return '0';
    return num.toFixed(8);
  };

  const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const isEnriching = enrichedPositions.some((pos) => pos.isLoading);
  const hasPosition = currentPositionForPool > 0;
  const showCalculator = totalAmount > 0 || manualAmount;

  // Get scenario display info
  const scenarioConfig = {
    low: { label: "Low", apy: pessimisticAPY, color: "#6366f1" },
    base: { label: "Base", apy: currentAPY, color: "#10b981" },
    high: { label: "High", apy: optimisticAPY, color: "#2dd4bf" },
  };
  const activeScenario = scenarioConfig[selectedScenario];

  // Calculate earnings based on selected scenario
  const scenarioAPY = activeScenario.apy;
  const dailyEarningsForScenario = (totalAmount * (scenarioAPY / 100)) / 365;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
    if (active && payload && payload.length && selectedPool) {
      const value = payload[0]?.value ?? 0;
      
      return (
        <div className="bg-[#0a1419]/98 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-2.5 shadow-2xl">
          <p className="text-[10px] text-white/40 mb-1 font-medium tracking-wide uppercase">
            Earnings at {label}
          </p>
          <p className="text-base font-semibold font-mono" style={{ color: activeScenario.color }}>
            +{formatEarnings(value)} <span className="text-xs opacity-70">{selectedPool.asset}</span>
          </p>
          <p className="text-[10px] text-white/30 mt-1">
            {activeScenario.label} scenario · {scenarioAPY.toFixed(2)}% APY
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Indexer Warning */}
      {!indexerStatus.isHealthy && !indexerStatus.isLoading && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg w-fit">
          <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-amber-300 font-medium">Data delayed: ~2d</span>
        </div>
      )}

      {/* Pending Deposit Indicator */}
      {isWhatIfMode && selectedPool && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#2dd4bf]/8 border border-[#2dd4bf]/20 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-[#2dd4bf] animate-pulse" />
          <span className="text-sm font-medium text-[#2dd4bf]">
            +{depositAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {selectedPool.asset}
          </span>
          {currentPositionForPool > 0 && (
            <span className="text-xs text-white/40 ml-auto">
              → {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} total
            </span>
          )}
        </div>
      )}

      {/* Position Summary */}
      <div>
        <div className="text-label mb-3">
          {isWhatIfMode ? "Current Position" : "Position Summary"}
        </div>

        {isLoading || isEnriching ? (
          <div className="flex items-center gap-2 py-4 text-white/50 text-sm">
            <div className="w-4 h-4 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin" />
            {isLoading ? "Loading..." : "Calculating..."}
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm py-2">Error: {error.message}</div>
        ) : !userAddress ? (
          <div className="text-white/40 text-sm py-2">Connect wallet to view positions</div>
        ) : positions.length === 0 ? (
          <div className="space-y-3">
            <div className="surface-metric">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#2dd4bf]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#2dd4bf] text-xs">→</span>
                </div>
                <div>
                  <p className="text-xs text-white/70 font-medium mb-1.5">After your first deposit:</p>
                  <ul className="space-y-1 text-[11px] text-white/50">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#2dd4bf]" />
                      Live balance with accrued interest
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      Earnings projection chart
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Cap ID */}
            {uniqueCapIds.length >= 1 && (
              <div className="flex items-center gap-2 text-[11px] text-white/40">
                <span>Cap:</span>
                {uniqueCapIds.length > 1 ? (
                  <>
                    <select
                      value={selectedCapId || ""}
                      onChange={(e) => setSelectedCapId(e.target.value)}
                      className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-[#2dd4bf] text-[11px] font-mono focus:outline-none focus:border-[#2dd4bf]/40 cursor-pointer appearance-none pr-6"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%232dd4bf'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 4px center',
                        backgroundSize: '12px'
                      }}
                    >
                      {uniqueCapIds.map((capId) => (
                        <option key={capId} value={capId} className="bg-[#0a1419] text-white">
                          {truncateAddress(capId)}
                        </option>
                      ))}
                    </select>
                    <a
                      href={`${explorerUrl}/object/${selectedCapId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2dd4bf] hover:text-[#5eead4] transition-colors"
                      title="View in explorer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <button
                      onClick={() => selectedCapId && copyToClipboard(selectedCapId)}
                      className="px-1.5 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] rounded text-white/50 text-[9px] transition-colors"
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
                      className="text-[#2dd4bf] hover:text-[#5eead4] font-mono transition-colors"
                    >
                      {truncateAddress(uniqueCapIds[0])}
                    </a>
                    <button
                      onClick={() => copyToClipboard(uniqueCapIds[0])}
                      className="px-1.5 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] rounded text-white/50 text-[9px] transition-colors"
                    >
                      Copy
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Positions */}
            {filteredPositions.map((pos) => (
              <div
                key={`${pos.supplierCapId}-${pos.asset}`}
                className="flex items-center justify-between px-3.5 py-3 surface-metric"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-white">{pos.asset}</span>
                  <span className="text-sm text-[#2dd4bf] font-medium font-mono">
                    {pos.currentValueFromChain || pos.balanceFormatted}
                  </span>
                </div>
                <span className="text-sm text-emerald-400 font-medium font-mono">
                  +{pos.interestEarned || "—"}
                </span>
              </div>
            ))}

            {/* Exit Status */}
            {selectedPool && currentPositionForPool > 0 && (() => {
              const availableLiquidity = selectedPool.state.supply - selectedPool.state.borrow;
              const canWithdrawFull = availableLiquidity >= currentPositionForPool;
              const withdrawablePct = Math.min((availableLiquidity / currentPositionForPool) * 100, 100);
              
              return (
                <div className={`px-3.5 py-2.5 rounded-lg border ${
                  canWithdrawFull 
                    ? 'bg-emerald-500/5 border-emerald-500/15' 
                    : 'bg-amber-500/8 border-amber-500/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className={`w-4 h-4 ${canWithdrawFull ? 'text-emerald-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`text-xs font-medium ${canWithdrawFull ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Exit Status
                      </span>
                    </div>
                    <span className={`text-xs font-semibold font-mono ${canWithdrawFull ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {canWithdrawFull ? '100%' : `${withdrawablePct.toFixed(0)}%`} available
                    </span>
                  </div>
                  <p className={`text-[10px] mt-1.5 ${canWithdrawFull ? 'text-emerald-300/60' : 'text-amber-300/70'}`}>
                    {canWithdrawFull 
                      ? 'You can withdraw your full position right now.'
                      : 'Wait for borrowers to repay for full exit.'
                    }
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Earnings Projection */}
      <div className="flex flex-col">
        <div className={`flex flex-col rounded-lg p-4 ${
          isWhatIfMode 
            ? 'bg-gradient-to-b from-[#2dd4bf]/5 to-transparent border border-[#2dd4bf]/15' 
            : 'surface-metric'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-medium text-white/70">
                Projection (Variable APY)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Period Toggle */}
              <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
                <button
                  onClick={() => setProjectionPeriod("30d")}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                    projectionPeriod === "30d" ? "bg-[#2dd4bf]/20 text-[#2dd4bf]" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  30d
                </button>
                <button
                  onClick={() => setProjectionPeriod("1y")}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                    projectionPeriod === "1y" ? "bg-[#2dd4bf]/20 text-[#2dd4bf]" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  1y
                </button>
              </div>
              {/* APY Badge */}
              <span 
                className="px-2 py-1 rounded-lg text-[10px] font-semibold font-mono"
                style={{ 
                  backgroundColor: `${activeScenario.color}15`,
                  color: activeScenario.color 
                }}
              >
                {scenarioAPY.toFixed(2)}% APY
              </span>
            </div>
          </div>

          {/* Scenario Toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-white/40">Scenario</span>
            <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
              <button
                onClick={() => setSelectedScenario("low")}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                  selectedScenario === "low" 
                    ? "bg-indigo-500/20 text-indigo-400" 
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Low
              </button>
              <button
                onClick={() => setSelectedScenario("base")}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                  selectedScenario === "base" 
                    ? "bg-emerald-500/20 text-emerald-400" 
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Base
              </button>
              <button
                onClick={() => setSelectedScenario("high")}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                  selectedScenario === "high" 
                    ? "bg-[#2dd4bf]/20 text-[#2dd4bf]" 
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                High
              </button>
            </div>
          </div>

          {/* Manual input */}
          {!isWhatIfMode && !hasPosition && (
            <div className="relative mb-3">
              <input
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="Enter amount to preview..."
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2dd4bf]/40 transition-all pr-14 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2dd4bf] text-xs font-medium">
                {selectedPool?.asset}
              </span>
            </div>
          )}

          {showCalculator && selectedPool ? (
            <div className="flex flex-col">
              {/* Chart */}
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeScenario.color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={activeScenario.color} stopOpacity={0.02} />
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
                      tickFormatter={(v) => v >= 1 ? `+${v.toFixed(1)}` : `+${v.toFixed(3)}`}
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <RechartsTooltip 
                      content={<CustomTooltip />}
                      cursor={{ stroke: activeScenario.color, strokeOpacity: 0.2, strokeWidth: 1 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={selectedScenario === "base" ? "current" : selectedScenario}
                      name={`${activeScenario.label} (${scenarioAPY.toFixed(1)}%)`}
                      stroke={activeScenario.color}
                      fill={`url(#${gradientId})`}
                      strokeWidth={2}
                      dot={false}
                      {...animationProps}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Est. daily earnings */}
              <div className="flex items-center justify-between px-3 py-2.5 mt-3 bg-white/[0.03] rounded-lg">
                <span className="text-[10px] text-white/40">Est. daily earnings</span>
                <span 
                  className="text-sm font-semibold font-mono"
                  style={{ color: activeScenario.color }}
                >
                  +{formatEarnings(dailyEarningsForScenario)} {selectedPool?.asset}
                </span>
              </div>

              {/* Scenario hint */}
              <p className="text-[9px] text-white/30 mt-2 italic">
                APY varies with pool utilization. Projections compound daily.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <svg className="w-10 h-10 text-white/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-white/40">Enter an amount to preview earnings</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="flex-1 flex items-center justify-between text-xs text-white/40 hover:text-white/60 transition-colors py-1.5"
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Transaction History</span>
              {transactions && transactions.length > 0 && (
                <span className="px-1.5 py-0.5 bg-white/[0.06] rounded text-[9px] text-white/50">
                  {transactions.length}
                </span>
              )}
            </div>
            {isHistoryExpanded ? (
              <ChevronUpIcon className="w-3.5 h-3.5" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5" />
            )}
          </button>
          {onViewAllHistory && (
            <button
              onClick={onViewAllHistory}
              className="text-xs text-[#2dd4bf] hover:text-[#5eead4] transition-colors font-medium ml-2"
            >
              View All →
            </button>
          )}
        </div>

        {isHistoryExpanded && (
          <div className="mt-2 max-h-24 overflow-y-auto">
            {historyLoading ? (
              <div className="text-center py-2 text-white/40 text-xs">Loading...</div>
            ) : !transactions || transactions.length === 0 ? (
              <div className="text-center py-2 text-white/30 text-xs">No transactions yet</div>
            ) : (
              <div className="space-y-1">
                {transactions.slice(0, 5).map((tx) => (
                  <a
                    key={tx.id}
                    href={`${explorerUrl}/txblock/${tx.transactionDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-2.5 py-2 surface-metric hover:bg-white/[0.05] transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${tx.type === "supply" ? "text-[#2dd4bf]" : "text-amber-400"}`}>
                        {tx.type === "supply" ? "↓" : "↑"}
                      </span>
                      <span className="text-xs text-white/80 font-mono">{tx.formattedAmount}</span>
                    </div>
                    <span className="text-[10px] text-white/40 group-hover:text-[#2dd4bf] transition-colors">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionsWithCalculator;
