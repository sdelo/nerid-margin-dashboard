import type { FC } from "react";
import React from "react";
import type { PoolOverview } from "../types";
import { InfoTooltip } from "../../../components/InfoTooltip";
import { useSuiClient } from "@mysten/dapp-kit";
import { MarginPool } from "../../../contracts/deepbook_margin/deepbook_margin/margin_pool";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

function formatNumber(n: number | bigint, decimals: number = 2) {
  const num = Number(n);
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + "K";
  }
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

type Props = {
  pool: PoolOverview | null;
  pools: PoolOverview[];
  selectedPoolId: string | null;
  onSelectPool: (poolId: string) => void;
};

export const StickyContextStrip: FC<Props> = ({
  pool,
  pools,
  selectedPoolId,
  onSelectPool,
}) => {
  const suiClient = useSuiClient();
  const [vaultBalance, setVaultBalance] = React.useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch vault balance
  React.useEffect(() => {
    async function fetchVaultBalance() {
      if (!pool) return;
      try {
        const response = await suiClient.getObject({
          id: pool.contracts.marginPoolId,
          options: { showBcs: true },
        });

        if (response.data?.bcs?.dataType === "moveObject") {
          const marginPool = MarginPool.fromBase64(response.data.bcs.bcsBytes);
          const value =
            Number(marginPool.vault.value) / 10 ** pool.contracts.coinDecimals;
          setVaultBalance(value);
        }
      } catch (error) {
        console.error("Error fetching vault balance:", error);
      }
    }

    fetchVaultBalance();
    const interval = setInterval(fetchVaultBalance, 15000);
    return () => clearInterval(interval);
  }, [pool, suiClient]);

  if (!pool) {
    return (
      <div className="h-14 bg-white/[0.02] rounded-xl animate-pulse" />
    );
  }

  const utilizationPct =
    pool.state.supply > 0
      ? (pool.state.borrow / pool.state.supply) * 100
      : 0;
  const available = vaultBalance ?? pool.state.supply - pool.state.borrow;

  // Status badge logic
  const getStatusBadge = () => {
    if (utilizationPct >= 80) {
      return { label: "HIGH UTIL", color: "bg-red-500/12 text-red-400" };
    }
    if (utilizationPct >= 50) {
      return { label: "OPTIMAL", color: "bg-[#2dd4bf]/12 text-[#2dd4bf]" };
    }
    return { label: "LOW UTIL", color: "bg-emerald-500/12 text-emerald-400" };
  };

  const statusBadge = getStatusBadge();

  const handlePoolSelect = (poolId: string) => {
    onSelectPool(poolId);
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-1.5">
      {/* Pool Selector - Left Anchor */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-all group"
        >
          <span className="text-[9px] text-white/40 uppercase tracking-wider font-medium">
            Pool:
          </span>
          <div className="flex items-center gap-2">
            <img
              src={
                pool.ui.iconUrl ||
                `https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png`
              }
              alt={pool.asset}
              className="w-5 h-5 rounded-full"
            />
            <span className="font-semibold text-white">{pool.asset}</span>
          </div>
          <ChevronDownIcon
            className={`w-4 h-4 text-white/50 transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute left-0 top-full mt-2 w-56 bg-[#0d1a1f] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Select Market
              </span>
            </div>
            <div className="py-1">
              {pools.map((p) => {
                const isActive = p.id === selectedPoolId;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePoolSelect(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all ${
                      isActive
                        ? "bg-[#2dd4bf]/10 text-white"
                        : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <img
                      src={
                        p.ui.iconUrl ||
                        `https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png`
                      }
                      alt={p.asset}
                      className="w-5 h-5 rounded-full"
                    />
                    <div className="flex-1 text-left">
                      <span className="font-medium">{p.asset}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-[#2dd4bf]">
                        {Number(p.ui.aprSupplyPct).toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-white/40 ml-1">APY</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Vertical Divider */}
      <div className="w-px h-6 bg-white/[0.08]" />

      {/* Snapshot Metrics - Compact inline */}
      <div className="flex items-center gap-3 flex-1">
        {/* APY */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">APY</span>
          <span className="text-sm font-semibold text-[#2dd4bf] font-mono">
            {Number(pool.ui.aprSupplyPct).toFixed(2)}%
          </span>
        </div>

        <span className="text-white/10">|</span>

        {/* Supplied */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Supplied</span>
          <span className="text-xs font-medium text-white font-mono">
            {formatNumber(pool.state.supply)}
          </span>
        </div>

        <span className="text-white/10">|</span>

        {/* Borrowed */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Borrowed</span>
          <span className="text-xs font-medium text-amber-400 font-mono">
            {formatNumber(pool.state.borrow)}
          </span>
        </div>

        <span className="text-white/10">|</span>

        {/* Available */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Avail</span>
          <span className="text-xs font-medium text-emerald-400 font-mono">
            {formatNumber(available)}
          </span>
        </div>

        <span className="text-white/10">|</span>

        {/* Utilization */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Util</span>
          <span className="text-xs font-medium text-white font-mono">
            {utilizationPct.toFixed(0)}%
          </span>
        </div>

        {/* Status Badge */}
        <div
          className={`px-2 py-0.5 rounded text-[8px] font-semibold tracking-wide ${statusBadge.color}`}
        >
          {statusBadge.label}
        </div>
      </div>
    </div>
  );
};

export default StickyContextStrip;
