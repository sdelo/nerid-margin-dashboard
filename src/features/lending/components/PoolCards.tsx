import type { FC } from "react";
import type { PoolOverview } from "../types";
import { Tooltip } from "../../../components/Tooltip";
import { useAppNetwork } from "../../../context/AppNetworkContext";

function formatNumber(n: number | bigint) {
  return Intl.NumberFormat('en-US').format(Number(n));
}

type Props = {
  pools: PoolOverview[];
  onDepositClick?: (poolId: string) => void;
  selectedPoolId?: string | null;
  onSelectPool?: (poolId: string) => void;
  onAdminAuditClick?: (poolId: string) => void;
  isLoading?: boolean;
};

export const PoolCards: FC<Props> = ({
  pools,
  onDepositClick,
  selectedPoolId,
  onSelectPool,
  onAdminAuditClick,
  isLoading = false,
}) => {
  const { explorerUrl } = useAppNetwork();

  // Fallback icons for when dynamic iconUrl is not available
  const FALLBACK_ICONS: Record<string, string> = {
    SUI: "https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png?1727791290",
    DBUSDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
    USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
    DEEP: "https://assets.coingecko.com/coins/images/38087/standard/deep.png?1728614086",
    WAL: "https://assets.coingecko.com/coins/images/54016/standard/walrus.jpg?1737525627",
  };
  // Get icon from pool's dynamic iconUrl or fall back to static icons
  const getIcon = (pool: PoolOverview) => pool.ui.iconUrl || FALLBACK_ICONS[pool.asset] || "";

  const getRiskLevel = (utilization: number) => {
    if (utilization >= 80) return { label: "Low Liquidity", color: "text-red-400", barColor: "bg-red-500" };
    if (utilization >= 50) return { label: "Optimal", color: "text-teal-400", barColor: "bg-amber-500" };
    return { label: "High Liquidity", color: "text-emerald-400", barColor: "bg-emerald-500" };
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="relative rounded-3xl p-6 border bg-white/5 border-white/10 animate-pulse">
            <div className="flex justify-between mb-6">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-white/10 rounded" />
                  <div className="h-3 w-16 bg-white/10 rounded" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div className="h-3 w-12 bg-white/10 rounded ml-auto" />
                <div className="h-6 w-16 bg-white/10 rounded ml-auto" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-2 w-full bg-white/10 rounded-full" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-white/10 rounded" />
                <div className="h-10 bg-white/10 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="p-8 text-center border border-white/10 rounded-3xl bg-white/5">
        <p className="text-cyan-100/70">No pools available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {pools.map((pool) => {
        const isSelected = pool.id === selectedPoolId;
        const supplyCap = Number(pool.protocolConfig.margin_pool_config.supply_cap);
        const supply = Number(pool.state.supply);
        const utilizationPct = pool.state.supply > 0 
          ? (pool.state.borrow / pool.state.supply) * 100 
          : 0;
        const risk = getRiskLevel(utilizationPct);
        
        return (
          <div 
            key={pool.id}
            onClick={() => onSelectPool?.(pool.id)}
            className={`
              relative rounded-2xl p-6 border transition-all duration-200 cursor-pointer group
              ${isSelected 
                ? "bg-white/10 border-teal-400/50" 
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
              }
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={getIcon(pool)}
                    alt={`${pool.asset} logo`}
                    className="w-10 h-10 rounded-full"
                  />
                  {isSelected && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-teal-400 rounded-full border-2 border-slate-900 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{pool.asset} Margin Pool</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`${risk.color} font-medium`}>{risk.label}</span>
                    <Tooltip content="Liquidity status based on utilization rate. High utilization means higher APY but potential withdrawal delays.">
                      <span className="text-white/40 cursor-help">ⓘ</span>
                    </Tooltip>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-cyan-200/70 mb-1">Supply APY</div>
                <div className="text-2xl font-extrabold text-cyan-300">
                  {Number(pool.ui.aprSupplyPct).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-4">
              {/* Utilization Bar */}
              <div>
                <div className="flex justify-between text-xs text-indigo-200/60 mb-2">
                  <span>Utilization</span>
                  <span>{utilizationPct.toFixed(2)}%</span>
                </div>
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${risk.barColor}`}
                    style={{ width: `${utilizationPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-xs text-indigo-200/60 mb-1">Total Supplied</div>
                  <div className="text-white font-semibold tabular-nums">
                    {formatNumber(pool.state.supply)} <span className="text-xs text-white/50">{pool.asset}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-indigo-200/60 mb-1">Total Borrowed</div>
                  <div className="text-white font-semibold tabular-nums">
                    {formatNumber(pool.state.borrow)} <span className="text-xs text-white/50">{pool.asset}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between mb-3">
                <a
                  href={`${explorerUrl}/object/${pool.contracts?.marginPoolId || pool.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="text-xs text-indigo-300 hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>View Contract</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdminAuditClick?.(pool.id);
                  }}
                  className="text-xs text-teal-300 hover:text-amber-100 transition-colors flex items-center gap-1"
                >
                  <span>⚙️ Admin History</span>
                </button>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDepositClick?.(pool.id);
                }}
                className={`
                  w-full px-4 py-2.5 rounded-lg text-sm font-bold transition-all
                  ${isSelected 
                    ? "bg-teal-400 text-slate-900 hover:bg-amber-300" 
                    : "bg-white/10 text-white hover:bg-white/15"
                  }
                `}
              >
                {isSelected ? "Deposit Now" : "Select Pool"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PoolCards;
