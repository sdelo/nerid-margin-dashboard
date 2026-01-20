import React from "react";
import type { PoolOverview } from "../types";
import { useSuiClient } from "@mysten/dapp-kit";
import { MarginPool } from "../../../contracts/deepbook_margin/deepbook_margin/margin_pool";

interface LiquidityHealthCheckProps {
  pool: PoolOverview;
}

export function LiquidityHealthCheck({ pool }: LiquidityHealthCheckProps) {
  const suiClient = useSuiClient();
  const [vaultBalance, setVaultBalance] = React.useState<number | null>(null);
  const [isLoadingVault, setIsLoadingVault] = React.useState(true);

  // Fetch vault balance from on-chain object
  React.useEffect(() => {
    async function fetchVaultBalance() {
      try {
        const response = await suiClient.getObject({
          id: pool.contracts.marginPoolId,
          options: {
            showBcs: true,
          },
        });

        if (
          response.data &&
          response.data.bcs &&
          response.data.bcs.dataType === "moveObject"
        ) {
          const marginPool = MarginPool.fromBase64(response.data.bcs.bcsBytes);
          const vaultValue =
            Number(marginPool.vault.value) / 10 ** pool.contracts.coinDecimals;
          setVaultBalance(vaultValue);
        }
      } catch (error) {
        console.error("Error fetching vault balance:", error);
      } finally {
        setIsLoadingVault(false);
      }
    }

    fetchVaultBalance();
    // Refresh every 15 seconds
    const interval = setInterval(fetchVaultBalance, 15000);
    return () => clearInterval(interval);
  }, [pool.contracts.marginPoolId, pool.contracts.coinDecimals, suiClient]);

  // Calculate metrics
  const totalDeposits = pool.state.supply;
  const availableLiquidity =
    vaultBalance ?? pool.state.supply - pool.state.borrow;
  const lockedInLoans = pool.state.borrow;
  const utilizationPercent =
    totalDeposits > 0 ? (lockedInLoans / totalDeposits) * 100 : 0;
  const withdrawablePercent =
    totalDeposits > 0 ? (availableLiquidity / totalDeposits) * 100 : 0;

  // Determine health status
  const getHealthStatus = () => {
    if (utilizationPercent > 90)
      return {
        label: "Critical Risk",
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/20",
        icon: "🚨",
        description:
          "Liquidity is extremely low. Large withdrawals may fail.",
      };
    if (utilizationPercent > 75)
      return {
        label: "High Risk",
        color: "text-teal-400",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/20",
        icon: "⚠️",
        description:
          "Liquidity is tightening. Some delays expected.",
      };
    if (utilizationPercent > 50)
      return {
        label: "Moderate",
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/20",
        icon: "⚡",
        description: "Good liquidity. Standard withdrawals available.",
      };
    return {
      label: "Healthy",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      icon: "✅",
      description: "Excellent liquidity. Instant withdrawals available.",
    };
  };

  const health = getHealthStatus();

  const formatNumber = (num: number) =>
    num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Liquidity Health Check
            {isLoadingVault && (
              <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full" />
            )}
          </h2>
          <p className="text-indigo-200/60 text-sm">
            Monitor pool stability and withdrawal availability for {pool.asset}
          </p>
        </div>
        
        <div className={`flex items-center gap-3 px-4 py-2 rounded-full border ${health.bgColor} ${health.borderColor}`}>
            <span className="text-xl">{health.icon}</span>
            <div>
                <div className={`text-sm font-bold ${health.color}`}>{health.label}</div>
                <div className="text-xs text-white/60">{health.description}</div>
            </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Deposits Card */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded text-white/60">Total Pool</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white mb-1">{formatNumber(totalDeposits)}</div>
            <div className="flex justify-between items-center">
                <span className="text-sm text-indigo-200/60">Total Supplied</span>
                <span className="text-xs text-blue-400 font-medium">{pool.asset}</span>
            </div>
          </div>
        </div>

        {/* Available Liquidity Card */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-emerald-500/30 transition-colors relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50" />
          <div className="flex justify-between items-start mb-4 relative">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <span className="text-xs font-medium bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded">
                {withdrawablePercent.toFixed(1)}% Available
            </span>
          </div>
          <div className="relative">
            <div className="text-2xl font-bold text-white mb-1">
                {isLoadingVault ? (
                    <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
                ) : (
                    formatNumber(availableLiquidity)
                )}
            </div>
            <div className="flex justify-between items-center">
                <span className="text-sm text-indigo-200/60">Available to Withdraw</span>
                <span className="text-xs text-emerald-400 font-medium">{pool.asset}</span>
            </div>
          </div>
        </div>

        {/* Locked Liquidity Card */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-orange-500/30 transition-colors relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50" />
          <div className="flex justify-between items-start mb-4 relative">
            <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            </div>
            <span className="text-xs font-medium bg-orange-500/10 text-orange-300 px-2 py-1 rounded">
                {utilizationPercent.toFixed(1)}% Utilization
            </span>
          </div>
          <div className="relative">
            <div className="text-2xl font-bold text-white mb-1">{formatNumber(lockedInLoans)}</div>
            <div className="flex justify-between items-center">
                <span className="text-sm text-indigo-200/60">Locked in Loans</span>
                <span className="text-xs text-orange-400 font-medium">{pool.asset}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visualization Bar */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex justify-between items-end mb-4">
            <div>
                <h3 className="text-sm font-semibold text-white mb-1">Liquidity Composition</h3>
                <p className="text-xs text-white/40">Visual breakdown of pool assets</p>
            </div>
            <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-white/60">Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-white/60">Borrowed</span>
                </div>
            </div>
        </div>

        <div className="h-4 bg-white/5 rounded-full overflow-hidden flex">
            <div 
                className="h-full bg-emerald-500 transition-all duration-1000 ease-out relative group"
                style={{ width: `${withdrawablePercent}%` }}
            >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div 
                className="h-full bg-orange-500 transition-all duration-1000 ease-out relative group"
                style={{ width: `${utilizationPercent}%` }}
            >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
        
        <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                <div className="text-xs text-white/40 mb-1">Max Utilization Cap</div>
                <div className="text-sm font-medium text-white">
                    {(pool.protocolConfig.margin_pool_config.max_utilization_rate * 100).toFixed(2)}%
                </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                <div className="text-xs text-white/40 mb-1">Remaining Buffer</div>
                <div className={`text-sm font-medium ${
                    pool.protocolConfig.margin_pool_config.max_utilization_rate * 100 - utilizationPercent < 10 
                    ? "text-red-400" 
                    : "text-emerald-400"
                }`}>
                    {(pool.protocolConfig.margin_pool_config.max_utilization_rate * 100 - utilizationPercent).toFixed(2)}%
                </div>
            </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-indigo-500/5 rounded-xl p-4 border border-indigo-500/10 flex items-start gap-3">
        <div className="p-2 bg-indigo-500/20 rounded-full text-indigo-300 shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
        <div className="text-sm text-indigo-200/80 leading-relaxed">
            <span className="text-indigo-200 font-medium block mb-1">Understanding Liquidity</span>
            High utilization means more assets are borrowed, which increases APY but reduces available liquidity for withdrawals. 
            Currently, <span className="text-white font-medium">{utilizationPercent.toFixed(1)}%</span> of the pool is borrowed.
            {utilizationPercent > 85 && (
                <span className="block mt-2 text-teal-300">
                    ⚠️ Caution: Pool is approaching max utilization. Large withdrawals may need to wait for loan repayments.
                </span>
            )}
        </div>
      </div>
    </div>
  );
}

