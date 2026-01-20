import React from "react";
import type { PoolOverview } from "../types";

interface EarningsCalculatorProps {
  pool: PoolOverview;
}

type TimeHorizon = "1W" | "1M" | "3M" | "6M" | "1Y";

const TIME_HORIZONS: { key: TimeHorizon; label: string; days: number }[] = [
  { key: "1W", label: "1 Week", days: 7 },
  { key: "1M", label: "1 Month", days: 30 },
  { key: "3M", label: "3 Months", days: 90 },
  { key: "6M", label: "6 Months", days: 180 },
  { key: "1Y", label: "1 Year", days: 365 },
];

export function EarningsCalculator({ pool }: EarningsCalculatorProps) {
  const [amount, setAmount] = React.useState<string>("1000");
  const [timeHorizon, setTimeHorizon] = React.useState<TimeHorizon>("1M");

  const currentAPY = pool.ui?.aprSupplyPct ?? 0;
  
  // Get the selected time horizon
  const selectedHorizon = TIME_HORIZONS.find((h) => h.key === timeHorizon)!;

  // Calculate projected earnings
  const calculateEarnings = React.useCallback(
    (depositAmount: number, apy: number, days: number) => {
      // Simple interest for short periods, compound for longer
      const dailyRate = apy / 100 / 365;
      
      if (days <= 30) {
        // Simple interest for short periods
        return depositAmount * dailyRate * days;
      } else {
        // Compound interest for longer periods
        const periods = days;
        const compoundedValue = depositAmount * Math.pow(1 + dailyRate, periods);
        return compoundedValue - depositAmount;
      }
    },
    []
  );

  const depositAmount = parseFloat(amount) || 0;
  const projectedEarnings = calculateEarnings(
    depositAmount,
    currentAPY,
    selectedHorizon.days
  );

  // Calculate range based on utilization curve
  // If utilization increased to optimal, what would APY be?
  const ic = pool.protocolConfig?.interest_config;
  const mc = pool.protocolConfig?.margin_pool_config;
  
  let optimisticAPY = currentAPY;
  let pessimisticAPY = currentAPY;
  let highUtilizationPct = 0;
  let lowUtilizationPct = 0;

  if (ic && mc) {
    const optimalU = ic.optimal_utilization;
    const baseRate = ic.base_rate;
    const baseSlope = ic.base_slope;
    const spread = mc.protocol_spread;

    // Optimistic: utilization goes to optimal
    const optimalBorrowAPY = baseRate + baseSlope * optimalU;
    const calculatedOptimisticAPY = optimalBorrowAPY * optimalU * (1 - spread) * 100;

    // Pessimistic: utilization drops to 50% of current or 1%, whichever is higher
    const currentUtil = pool.state?.supply > 0 
      ? pool.state.borrow / pool.state.supply 
      : 0;
    const lowUtil = Math.max(currentUtil * 0.5, 0.01);
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

  const optimisticEarnings = calculateEarnings(
    depositAmount,
    optimisticAPY,
    selectedHorizon.days
  );
  const pessimisticEarnings = calculateEarnings(
    depositAmount,
    pessimisticAPY,
    selectedHorizon.days
  );

  // Format number with appropriate precision
  const formatEarnings = (num: number) => {
    if (num < 0.01) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    if (num < 100) return num.toFixed(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatAPY = (apy: number) => {
    if (apy < 0.01) return apy.toFixed(4);
    if (apy < 1) return apy.toFixed(2);
    return apy.toFixed(1);
  };

  // Calculate daily earnings for context
  const dailyEarnings = calculateEarnings(depositAmount, currentAPY, 1);

  return (
    <div className="bg-gradient-to-br from-cyan-900/20 via-teal-900/10 to-indigo-900/20 rounded-2xl p-5 border border-cyan-500/20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="2" width="16" height="20" rx="2" stroke="#22d3ee" strokeWidth="1.5" fill="#22d3ee" fillOpacity="0.15"/>
            <rect x="7" y="5" width="10" height="3" rx="1" fill="#22d3ee" fillOpacity="0.5"/>
            <circle cx="8" cy="11" r="1" fill="#22d3ee"/>
            <circle cx="12" cy="11" r="1" fill="#22d3ee"/>
            <circle cx="16" cy="11" r="1" fill="#22d3ee"/>
            <circle cx="8" cy="14" r="1" fill="#22d3ee"/>
            <circle cx="12" cy="14" r="1" fill="#22d3ee"/>
            <circle cx="16" cy="14" r="1" fill="#22d3ee"/>
            <circle cx="8" cy="17" r="1" fill="#22d3ee"/>
            <rect x="11" y="16" width="6" height="2" rx="0.5" fill="#22d3ee"/>
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Earnings Calculator</h3>
          <p className="text-xs text-cyan-300/60">Estimate projected returns</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">Deposit Amount</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 font-medium">
              {pool.asset}
            </span>
          </div>
        </div>

        {/* Time Horizon Selector */}
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">Time Horizon</label>
          <div className="grid grid-cols-5 gap-1.5">
            {TIME_HORIZONS.map((horizon) => (
              <button
                key={horizon.key}
                onClick={() => setTimeHorizon(horizon.key)}
                className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                  timeHorizon === horizon.key
                    ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white"
                }`}
              >
                {horizon.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="mt-5 pt-5 border-t border-white/10">
        {/* Main Projection */}
        <div className="text-center mb-4">
          <div className="text-xs text-white/50 mb-1">Projected Earnings</div>
          <div className="text-4xl font-bold text-cyan-400">
            +{formatEarnings(projectedEarnings)}
            <span className="text-lg ml-1 text-cyan-400/70">{pool.asset}</span>
          </div>
          <div className="text-sm text-white/60 mt-1">
            at current {formatAPY(currentAPY)}% APY
          </div>
        </div>

        {/* Range Visualization */}
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-white/50">Earnings Range</span>
            <span className="text-xs text-white/40">Based on utilization scenarios</span>
          </div>
          
          <div className="relative h-8 bg-white/5 rounded-full overflow-hidden">
            {/* Range bar */}
            <div 
              className="absolute h-full bg-gradient-to-r from-indigo-500/30 via-cyan-500/50 to-teal-500/30 rounded-full"
              style={{
                left: `${Math.max(0, (pessimisticEarnings / optimisticEarnings) * 30)}%`,
                right: "10%",
              }}
            />
            {/* Current position marker */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-cyan-400 rounded-full shadow-lg shadow-cyan-500/50"
              style={{
                left: `${Math.min(90, Math.max(10, (projectedEarnings / optimisticEarnings) * 90))}%`,
              }}
            />
          </div>
          
          <div className="flex justify-between mt-2 text-xs">
            <div className="text-indigo-400">
              <div className="font-medium">Low{lowUtilizationPct > 0 ? ` (${lowUtilizationPct.toFixed(0)}% util)` : ''}</div>
              <div className="text-white/60">+{formatEarnings(pessimisticEarnings)}</div>
            </div>
            <div className="text-cyan-400 text-center">
              <div className="font-medium">Current</div>
              <div className="text-white/60">+{formatEarnings(projectedEarnings)}</div>
            </div>
            <div className="text-teal-400 text-right">
              <div className="font-medium">High{highUtilizationPct > 0 ? ` (${highUtilizationPct.toFixed(0)}% util)` : ''}</div>
              <div className="text-white/60">+{formatEarnings(optimisticEarnings)}</div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/50 mb-1">Per Day</div>
            <div className="text-lg font-semibold text-white">
              +{formatEarnings(dailyEarnings)}
              <span className="text-xs ml-1 text-white/50">{pool.asset}</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/50 mb-1">Total After {selectedHorizon.label}</div>
            <div className="text-lg font-semibold text-white">
              {formatEarnings(depositAmount + projectedEarnings)}
              <span className="text-xs ml-1 text-white/50">{pool.asset}</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 text-[10px] text-white/40 text-center">
          Projections based on current APY. Actual returns will vary based on pool utilization.
        </div>
      </div>
    </div>
  );
}

