import { Link } from "react-router-dom";
import type { PoolOverview } from "../features/lending/types";
import { formatCurrency, utilizationPct } from "../utils/format";

interface LandingPoolCardProps {
  pool: PoolOverview;
}

// Fallback icons for when dynamic iconUrl is not available
const FALLBACK_ICONS: Record<string, string> = {
  SUI: "https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png?1727791290",
  DBUSDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
  USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
  DEEP: "https://assets.coingecko.com/coins/images/38087/standard/deep.png?1728614086",
  WAL: "https://assets.coingecko.com/coins/images/54016/standard/walrus.jpg?1737525627",
};

export function LandingPoolCard({ pool }: LandingPoolCardProps) {
  // Get icon from pool's dynamic iconUrl or fall back to static icons
  const getIcon = () => pool.ui.iconUrl || FALLBACK_ICONS[pool.asset] || "";
  const supply = Number(pool.state.supply);
  const borrowed = Number(pool.state.borrow);
  const utilization = utilizationPct(pool.state.supply, pool.state.borrow);
  const utilizationNum = Number(utilization);

  return (
    <Link
      to={`/pools?pool=${pool.id}`}
      className="group block relative rounded-2xl p-6 cursor-pointer
        bg-gradient-to-b from-[rgba(20,40,52,0.7)] to-[rgba(13,26,31,0.6)]
        border border-[rgba(45,212,191,0.12)]
        backdrop-blur-xl
        shadow-[0_4px_32px_-8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]
        transition-all duration-300 ease-out
        hover:border-[rgba(45,212,191,0.35)]
        hover:shadow-[0_8px_48px_-12px_rgba(45,212,191,0.15),0_4px_24px_-8px_rgba(0,0,0,0.4)]
        hover:-translate-y-1"
    >
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(45, 212, 191, 0.08) 0%, transparent 70%)'
        }}
      />
      
      {/* Header - Asset identity */}
      <div className="relative flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06]">
        <img
          src={getIcon()}
          alt={`${pool.asset} logo`}
          className="w-10 h-10 rounded-full ring-2 ring-white/10 group-hover:ring-[rgba(45,212,191,0.3)] transition-all duration-300"
        />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white group-hover:text-[#2dd4bf] transition-colors duration-300">{pool.asset}</h3>
          <p className="text-xs text-white/40">Margin Pool</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[#2dd4bf]">
            {Number(pool.ui.aprSupplyPct).toFixed(2)}%
          </div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">APY</p>
        </div>
      </div>

      {/* Metrics Row - Utilization is the main story, it drives APY */}
      <div className="relative grid grid-cols-3 gap-3 mb-5">
        <div className="text-center p-3 rounded-xl bg-[rgba(13,26,31,0.5)] border border-white/[0.04]">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">TVL</p>
          <p className="text-sm font-semibold text-white font-mono">
            ${formatCurrency(supply)}
          </p>
        </div>
        <div className={`text-center p-3 rounded-xl border ${
          utilizationNum > 50 
            ? 'bg-[rgba(45,212,191,0.08)] border-[rgba(45,212,191,0.15)]' 
            : 'bg-[rgba(13,26,31,0.5)] border-white/[0.04]'
        }`}>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Utilization</p>
          <p className={`text-sm font-semibold font-mono ${
            utilizationNum > 50 ? 'text-[#2dd4bf]' : 'text-white'
          }`}>{utilization}%</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-[rgba(13,26,31,0.5)] border border-white/[0.04]">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Borrowed</p>
          <p className="text-sm font-semibold text-white/80 font-mono">
            ${formatCurrency(borrowed)}
          </p>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="relative mb-5">
        <div className="h-1.5 w-full bg-[rgba(13,26,31,0.6)] rounded-full overflow-hidden border border-white/[0.04]">
          <div
            className="h-full bg-gradient-to-r from-[#2dd4bf] to-[#14b8a6] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Number(utilization))}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="relative flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] group-hover:bg-[rgba(45,212,191,0.08)] group-hover:border-[rgba(45,212,191,0.2)] transition-all duration-300">
        <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors duration-300">
          View Pool
        </span>
        <svg 
          className="w-4 h-4 text-white/50 group-hover:text-[#2dd4bf] group-hover:translate-x-1 transition-all duration-300" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
