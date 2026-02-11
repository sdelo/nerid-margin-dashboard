import React from "react";
import type { PoolOverview } from "../types";

interface EnhancedPoolAnalytics extends PoolOverview {
  vaultBalance: number;
  trueSupplyWithInterest: number;
  utilizationPercent: number;
  borrowApr: number;
}

export function EnhancedPoolAnalytics({ pool, vaultBalance: externalVaultBalance }: { pool: PoolOverview; vaultBalance?: number | null }) {
  // Use centralized vault balance from parent (useVaultBalances hook)
  const vaultBalance = externalVaultBalance ?? null;
  const isLoadingVault = vaultBalance === null;

  // Calculate enhanced metrics
  const analytics: EnhancedPoolAnalytics = React.useMemo(() => {
    const utilizationPercent =
      pool.state.supply > 0 ? (pool.state.borrow / pool.state.supply) * 100 : 0;

    // Calculate borrow APR from interest rate model
    const interestConfig = pool.protocolConfig.interest_config;
    const optimalUtilization = interestConfig.optimal_utilization;
    const currentUtilization = utilizationPercent / 100;

    let borrowApr: number;
    if (currentUtilization <= optimalUtilization) {
      // Below optimal: base_rate + base_slope * utilization
      borrowApr =
        interestConfig.base_rate +
        interestConfig.base_slope * currentUtilization;
    } else {
      // Above optimal: base_rate + base_slope * optimal_u + excess_slope * (u - optimal_u)
      borrowApr =
        interestConfig.base_rate +
        interestConfig.base_slope * optimalUtilization +
        interestConfig.excess_slope * (currentUtilization - optimalUtilization);
    }

    // Supply APR = Borrow APR * utilization * (1 - protocol_spread)
    const supplyApr =
      borrowApr *
      currentUtilization *
      (1 - pool.protocolConfig.margin_pool_config.protocol_spread);

    return {
      ...pool,
      vaultBalance: vaultBalance ?? pool.state.supply - pool.state.borrow,
      trueSupplyWithInterest: pool.state.supply,
      utilizationPercent,
      borrowApr: borrowApr * 100, // Convert to percentage
    };
  }, [pool, vaultBalance]);

  return (
    <div className="space-y-6">
      {/* Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Supply */}
        <div className="card-surface p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">💎</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {analytics.trueSupplyWithInterest.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-sm text-white/60">
              Total Supply (with interest)
            </div>
            <div className="text-xs text-cyan-300">{pool.asset}</div>
          </div>
        </div>

        {/* Total Borrowed */}
        <div className="card-surface p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📊</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {pool.state.borrow.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-sm text-white/60">Total Borrowed</div>
            <div className="text-xs text-teal-300">{pool.asset}</div>
          </div>
        </div>

        {/* Vault Balance (Available Liquidity) */}
        <div className="card-surface p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🏦</span>
            {isLoadingVault && (
              <div className="animate-pulse h-2 w-2 rounded-full bg-green-400"></div>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {isLoadingVault ? (
                <div className="h-8 w-24 bg-white/10 rounded animate-pulse"></div>
              ) : (
                analytics.vaultBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              )}
            </div>
            <div className="text-sm text-white/60">
              Vault Balance (Available)
            </div>
            <div className="text-xs text-green-300">{pool.asset}</div>
          </div>
        </div>

        {/* Utilization Rate */}
        <div className="card-surface p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📈</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {analytics.utilizationPercent.toFixed(2)}%
            </div>
            <div className="text-sm text-white/60">Utilization Rate</div>
            <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  analytics.utilizationPercent > 90
                    ? "bg-red-500 animate-pulse"
                    : analytics.utilizationPercent > 75
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-cyan-500 to-blue-500"
                }`}
                style={{
                  width: `${Math.min(analytics.utilizationPercent, 100)}%`,
                }}
              ></div>
            </div>
            {analytics.utilizationPercent > 90 && (
              <div className="mt-2 text-xs text-red-300 flex items-center gap-1">
                ⚠️ High utilization! Withdrawals may be limited.
              </div>
            )}
          </div>
        </div>

        {/* Borrow APR */}
        <div className="card-surface p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📉</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-teal-400">
              {analytics.borrowApr.toFixed(3)}%
            </div>
            <div className="text-sm text-white/60">Borrow APR</div>
            <div className="text-xs text-white/40">What borrowers pay</div>
          </div>
        </div>

        {/* Supply APR */}
        <div className="card-surface p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">✨</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-400">
              {pool.ui.aprSupplyPct.toFixed(3)}%
            </div>
            <div className="text-sm text-white/60">Supply APR</div>
            <div className="text-xs text-white/40">What suppliers earn</div>
          </div>
        </div>
      </div>

      {/* Pool Configuration */}
      <div className="card-surface p-6 rounded-2xl border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">
          Pool Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Supply Configuration */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
              Supply Limits
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Supply Cap</span>
                <span className="text-white font-semibold">
                  {pool.protocolConfig.margin_pool_config.supply_cap.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Current Supply</span>
                <span className="text-cyan-300 font-semibold">
                  {pool.state.supply.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Supply % of Cap</span>
                <span className="text-white font-semibold">
                  {(
                    (pool.state.supply /
                      pool.protocolConfig.margin_pool_config.supply_cap) *
                    100
                  ).toFixed(2)}
                  %
                </span>
              </div>

              <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                  style={{
                    width: `${Math.min((pool.state.supply / pool.protocolConfig.margin_pool_config.supply_cap) * 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Borrow Configuration */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
              Borrow Limits
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Min Borrow</span>
                <span className="text-white font-semibold">
                  {pool.protocolConfig.margin_pool_config.min_borrow.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Max Utilization</span>
                <span className="text-white font-semibold">
                  {(
                    pool.protocolConfig.margin_pool_config
                      .max_utilization_rate * 100
                  ).toFixed(2)}
                  %
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Protocol Spread</span>
                <span className="text-white font-semibold">
                  {(
                    pool.protocolConfig.margin_pool_config.protocol_spread * 100
                  ).toFixed(2)}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
