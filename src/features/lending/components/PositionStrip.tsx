import type { FC } from "react";
import React, { useState, useMemo } from "react";
import type { UserPosition, PoolOverview } from "../types";
import { useEnrichedUserPositions } from "../../../hooks/useEnrichedUserPositions";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import { useUserActivity, type UserTransaction } from "../hooks/useUserActivity";
import { ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon, ArrowTopRightOnSquareIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useChartFirstRender, useStableGradientId } from "../../../components/charts/StableChart";

type ScenarioType = "low" | "base" | "high";

type Props = {
  userAddress: string | undefined;
  pools: PoolOverview[];
  selectedPool: PoolOverview | null;
  positions?: UserPosition[];
  onViewAllHistory?: () => void;
};

function generateProjectionData(
  totalAmount: number,
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

export const PositionStrip: FC<Props> = ({
  userAddress,
  pools,
  selectedPool,
  positions = [],
  onViewAllHistory,
}) => {
  const { explorerUrl } = useAppNetwork();
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isCalculatorExpanded, setIsCalculatorExpanded] = useState(false);
  const [projectionPeriod, setProjectionPeriod] = useState<"30d" | "1y">("30d");
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("base");
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const enrichedPositions = useEnrichedUserPositions(positions, pools);

  // Get current position for selected pool
  const currentPositionData = useMemo(() => {
    if (!selectedPool) return null;
    const position = enrichedPositions.find((p) => p.asset === selectedPool.asset);
    if (!position) return null;
    
    const match = position.balanceFormatted.match(/^([\d.,]+)/);
    const balance = match ? parseFloat(match[1].replace(/,/g, '')) || 0 : 0;
    
    return {
      balance,
      balanceFormatted: position.currentValueFromChain || position.balanceFormatted,
      interestEarned: position.interestEarned || "0",
      supplierCapId: position.supplierCapId,
    };
  }, [enrichedPositions, selectedPool]);

  // Get supplier cap IDs for this position's pool
  const supplierCapIds = useMemo(() => {
    if (!currentPositionData?.supplierCapId) return [];
    return [currentPositionData.supplierCapId];
  }, [currentPositionData?.supplierCapId]);

  // Fetch position history
  const { transactions: positionHistory, isLoading: historyLoading } = useUserActivity(
    userAddress,
    selectedPool?.contracts?.marginPoolId,
    undefined,
    supplierCapIds
  );

  // Get last transaction for collapsed state preview
  const lastTransaction = useMemo(() => {
    if (!positionHistory || positionHistory.length === 0) return null;
    return positionHistory[0];
  }, [positionHistory]);

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
      return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'just now';
  };

  // Format short date for history rows
  const formatShortDate = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'just now';
  };

  // Copy tx hash to clipboard
  const handleCopyTx = async (txDigest: string) => {
    try {
      await navigator.clipboard.writeText(txDigest);
      setCopiedTxId(txDigest);
      setTimeout(() => setCopiedTxId(null), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  // Calculate exit availability
  const exitAvailability = useMemo(() => {
    if (!selectedPool || !currentPositionData || currentPositionData.balance <= 0) {
      return { available: true, pct: 100 };
    }
    const availableLiquidity = selectedPool.state.supply - selectedPool.state.borrow;
    const canWithdrawFull = availableLiquidity >= currentPositionData.balance;
    const withdrawablePct = Math.min((availableLiquidity / currentPositionData.balance) * 100, 100);
    return { available: canWithdrawFull, pct: withdrawablePct };
  }, [selectedPool, currentPositionData]);

  // APY calculations for projections
  const { currentAPY, optimisticAPY, pessimisticAPY } = useMemo(() => {
    const apy = selectedPool?.ui?.aprSupplyPct ?? 0;
    const ic = selectedPool?.protocolConfig?.interest_config;
    const mc = selectedPool?.protocolConfig?.margin_pool_config;

    let optimistic = apy;
    let pessimistic = apy;

    if (ic && mc) {
      const optimalU = ic.optimal_utilization;
      const baseRate = ic.base_rate;
      const baseSlope = ic.base_slope;
      const spread = mc.protocol_spread;

      const optimalBorrowAPY = baseRate + baseSlope * optimalU;
      const calculatedOptimisticAPY = optimalBorrowAPY * optimalU * (1 - spread) * 100;

      const lowUtil = optimalU * 0.25;
      const lowBorrowAPY = baseRate + baseSlope * lowUtil;
      const calculatedPessimisticAPY = lowBorrowAPY * lowUtil * (1 - spread) * 100;

      optimistic = Math.max(calculatedOptimisticAPY, apy);
      // Low is min of calculated pessimistic OR current minus 20%
      pessimistic = Math.min(calculatedPessimisticAPY, apy * 0.8);
    }

    return { currentAPY: apy, optimisticAPY: optimistic, pessimisticAPY: pessimistic };
  }, [selectedPool]);

  // Chart data
  const chartData = useMemo(
    () => generateProjectionData(currentPositionData?.balance || 0, currentAPY, pessimisticAPY, optimisticAPY, projectionPeriod),
    [currentPositionData?.balance, currentAPY, pessimisticAPY, optimisticAPY, projectionPeriod]
  );

  const { animationProps } = useChartFirstRender(chartData.length > 0);
  const gradientId = useStableGradientId('posStripGradient');

  // Earnings calculations
  const totalAmount = currentPositionData?.balance || 0;

  const formatEarnings = (num: number) => {
    if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (num >= 1) return num.toFixed(2);
    if (num >= 0.01) return num.toFixed(4);
    if (num >= 0.0001) return num.toFixed(6);
    if (num === 0) return '0';
    return num.toFixed(8);
  };

  // Scenario config
  const scenarioConfig = {
    low: { label: "Low", apy: pessimisticAPY, color: "#6366f1" },
    base: { label: "Base", apy: currentAPY, color: "#10b981" },
    high: { label: "High", apy: optimisticAPY, color: "#2dd4bf" },
  };
  const activeScenario = scenarioConfig[selectedScenario];
  const scenarioAPY = activeScenario.apy;
  const dailyEarnings = (totalAmount * (scenarioAPY / 100)) / 365;

  const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

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

  // If no wallet connected or no position, show minimal empty state
  if (!userAddress) {
    return (
      <div className="surface-elevated p-4">
        <div className="text-xs text-white/40 text-center">
          Connect wallet to view your position
        </div>
      </div>
    );
  }

  if (!currentPositionData || currentPositionData.balance <= 0) {
    return (
      <div className="surface-elevated p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <h3 className="text-sm font-medium text-white/60">Your position</h3>
        </div>
        <div className="text-xs text-white/40">
          No position yet. Deposit to start earning.
        </div>
      </div>
    );
  }

  return (
    <div className="surface-elevated overflow-hidden">
      {/* Minimal Position Strip */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf]" />
          <h3 className="text-sm font-medium text-white">Your position</h3>
        </div>

        {/* Position Details - Minimal */}
        <div className="space-y-2">
          {/* Supplied */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Supplied</span>
            <span className="text-sm font-mono text-white">
              {currentPositionData.balanceFormatted}
            </span>
          </div>

          {/* Earned */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Earned</span>
            <span className="text-sm font-mono text-emerald-400">
              +{currentPositionData.interestEarned}
            </span>
          </div>

          {/* Exit Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Exit</span>
            <span className={`text-sm font-medium ${exitAvailability.available ? 'text-emerald-400' : 'text-amber-400'}`}>
              {exitAvailability.available ? '100%' : `${exitAvailability.pct.toFixed(0)}%`} available
            </span>
          </div>

          {/* Cap ID link */}
          {currentPositionData.supplierCapId && (
            <div className="pt-2 border-t border-white/[0.06]">
              <a
                href={`${explorerUrl}/object/${currentPositionData.supplierCapId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-white/40 hover:text-[#2dd4bf] transition-colors font-mono"
              >
                Cap: {truncateAddress(currentPositionData.supplierCapId)} ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Position History Accordion */}
      <div className="border-t border-white/[0.06]">
        <button
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-white/[0.02] transition-all group"
        >
          <span className="text-white/50 group-hover:text-white/70">Position history</span>
          <div className="flex items-center gap-2">
            {/* Last transaction preview when collapsed */}
            {!isHistoryExpanded && lastTransaction && (
              <span className="text-[10px] text-white/40">
                Last: {lastTransaction.type === 'supply' ? 'Deposit' : 'Withdraw'}{' '}
                <span className={lastTransaction.type === 'supply' ? 'text-emerald-400' : 'text-white/60'}>
                  {lastTransaction.type === 'supply' ? '+' : '-'}{lastTransaction.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedPool?.asset}
                </span>
                {' • '}
                {formatRelativeTime(lastTransaction.timestamp)}
              </span>
            )}
            {historyLoading && !isHistoryExpanded && (
              <div className="w-3 h-3 border border-white/30 border-t-transparent rounded-full animate-spin" />
            )}
            {isHistoryExpanded ? (
              <ChevronUpIcon className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" />
            )}
          </div>
        </button>

        {isHistoryExpanded && (
          <div className="px-4 pt-1 pb-3 space-y-2 animate-fade-in">
            {historyLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-xs text-white/40">Loading history...</span>
              </div>
            ) : positionHistory.length === 0 ? (
              <div className="text-center py-3 text-xs text-white/40">
                No transaction history yet
              </div>
            ) : (
              <>
                {/* Transaction rows - show last 5-10 */}
                <div className="space-y-1.5">
                  {positionHistory.slice(0, 8).map((tx) => (
                    <div 
                      key={tx.id}
                      className="p-2 bg-white/[0.02] rounded-lg border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                    >
                      {/* Main row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Icon */}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            tx.type === 'supply' 
                              ? 'bg-emerald-500/15' 
                              : 'bg-white/[0.06]'
                          }`}>
                            {tx.type === 'supply' ? (
                              <ArrowDownTrayIcon className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <ArrowUpTrayIcon className="w-3 h-3 text-white/60" />
                            )}
                          </div>
                          {/* Label */}
                          <span className="text-xs font-medium text-white/80">
                            {tx.type === 'supply' ? 'Deposit' : 'Withdraw'}
                          </span>
                        </div>

                        {/* Amount + Time */}
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-mono font-medium ${
                            tx.type === 'supply' ? 'text-emerald-400' : 'text-white/60'
                          }`}>
                            {tx.type === 'supply' ? '+' : '-'}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {selectedPool?.asset}
                          </span>
                          <span className="text-[10px] text-white/40 min-w-[50px] text-right">
                            {formatShortDate(tx.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Secondary row - Tx hash */}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] text-white/30 font-mono">
                          Tx: {tx.transactionDigest.slice(0, 6)}…{tx.transactionDigest.slice(-4)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyTx(tx.transactionDigest);
                          }}
                          className="p-0.5 rounded hover:bg-white/[0.06] transition-colors text-white/30 hover:text-white/60"
                          title="Copy transaction hash"
                        >
                          {copiedTxId === tx.transactionDigest ? (
                            <CheckCircleIcon className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <DocumentDuplicateIcon className="w-3 h-3" />
                          )}
                        </button>
                        <a
                          href={`${explorerUrl}/txblock/${tx.transactionDigest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-0.5 rounded hover:bg-white/[0.06] transition-colors text-white/30 hover:text-[#2dd4bf]"
                          title="View on explorer"
                        >
                          <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* View all activity link */}
                {onViewAllHistory && (
                  <button
                    onClick={onViewAllHistory}
                    className="w-full py-2 text-[11px] text-[#2dd4bf] hover:text-[#5eead4] transition-colors text-center"
                  >
                    View all activity →
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Expandable Calculator / Projections */}
      <div className="border-t border-white/[0.06]">
        <button
          onClick={() => setIsCalculatorExpanded(!isCalculatorExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-white/50 hover:text-white/70 hover:bg-white/[0.02] transition-all"
        >
          <span>View projections / calculator →</span>
          {isCalculatorExpanded ? (
            <ChevronUpIcon className="w-3.5 h-3.5" />
          ) : (
            <ChevronDownIcon className="w-3.5 h-3.5" />
          )}
        </button>

        {isCalculatorExpanded && (
          <div className="p-4 pt-0 space-y-3 animate-fade-in">
            {/* Period Toggle + APY Badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/60">
                Projection (Variable APY)
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
                  <button
                    onClick={() => setProjectionPeriod("30d")}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                      projectionPeriod === "30d" ? "bg-[#2dd4bf]/20 text-[#2dd4bf]" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => setProjectionPeriod("1y")}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                      projectionPeriod === "1y" ? "bg-[#2dd4bf]/20 text-[#2dd4bf]" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    1y
                  </button>
                </div>
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
            <div className="flex items-center justify-between">
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

            {/* Chart - Single line based on selected scenario */}
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 5 }}>
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
                    width={48}
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

            {/* Est earnings */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-lg">
              <span className="text-[10px] text-white/40">Est. daily earnings</span>
              <span 
                className="text-sm font-semibold font-mono"
                style={{ color: activeScenario.color }}
              >
                +{formatEarnings(dailyEarnings)} {selectedPool?.asset}
              </span>
            </div>

            {/* Assumptions note */}
            <p className="text-[9px] text-white/30 italic">
              APY varies with pool utilization. Projections compound daily.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionStrip;
