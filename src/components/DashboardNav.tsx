import React, { useState, useEffect } from "react";
import { useAllPools } from "../hooks/useAllPools";

interface DashboardNavProps {
  className?: string;
  selectedPoolId?: string;
  onSelectPool?: (poolId: string) => void;
}

const NAV_ITEMS = [
  { id: "pools-deposit", label: "Pools & Deposit", icon: "🏊" },
  { id: "yield-interest", label: "Yield & Interest", icon: "📈" },
  { id: "depositors", label: "Depositors", icon: "👥" },
  { id: "activity", label: "Activity", icon: "📊" },
  { id: "fees", label: "Fees & Liquidations", icon: "💰" },
];

// Fallback icons for when dynamic iconUrl is not available
const FALLBACK_ICONS: Record<string, string> = {
  SUI: "https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png?1727791290",
  DBUSDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
  USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
  DEEP: "https://assets.coingecko.com/coins/images/38087/standard/deep.png?1728614086",
  WAL: "https://assets.coingecko.com/coins/images/54016/standard/walrus.jpg?1737525627",
};
// Get icon from pool's dynamic iconUrl or fall back to static icons
const getPoolIcon = (pool: { asset: string; ui?: { iconUrl?: string | null } }) => 
  pool.ui?.iconUrl || FALLBACK_ICONS[pool.asset] || "";

export function DashboardNav({
  className = "",
  selectedPoolId,
  onSelectPool,
}: DashboardNavProps) {
  const [activeSection, setActiveSection] = useState<string>("pools-deposit");

  // Fetch all pools dynamically
  const { pools } = useAllPools();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0.1,
      }
    );

    // Observe all sections
    NAV_ITEMS.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <>
      {/* Desktop Vertical Sidebar */}
      <nav
        className={`fixed left-0 top-[64px] z-40 w-64 h-[calc(100vh-64px)] vertical-nav hidden lg:block ${className}`}
      >
        <div className="h-full flex flex-col py-6 px-4">
          {/* Pool Selection for Desktop */}
          {onSelectPool && (
            <div className="mb-6 pb-6 border-b border-white/10">
              <div className="text-sm font-semibold text-cyan-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Select Pool
              </div>
              <div className="space-y-2">
                {pools.map((pool) => (
                  <button
                    key={pool.id}
                    onClick={() => onSelectPool(pool.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border
                      ${
                        selectedPoolId === pool.id
                          ? "bg-teal-400/20 border-teal-400/50 text-white"
                          : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                      }
                    `}
                  >
                    <img
                      src={getPoolIcon(pool)}
                      alt={`${pool.asset} logo`}
                      className="w-5 h-5 rounded flex-shrink-0"
                    />
                    <span className="font-bold flex-shrink-0">
                      {pool.asset}
                    </span>
                    <span className="text-teal-300 font-bold flex-shrink-0 ml-auto">
                      {Number(pool.ui.aprSupplyPct).toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 min-h-[48px]
                  ${
                    activeSection === item.id
                      ? "bg-teal-400 text-[#0c1a24]"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile Horizontal Navigation */}
      <nav
        className={`sticky top-[64px] z-40 horizontal-nav lg:hidden ${className}`}
      >
        <div className="max-w-[1400px] mx-auto px-4">
          {/* Pool Selection */}
          {onSelectPool && (
            <div className="py-3 border-b border-white/10">
              <div className="text-sm font-semibold text-cyan-200 mb-2">
                Select Pool:
              </div>
              <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
                {pools.map((pool) => (
                  <button
                    key={pool.id}
                    onClick={() => onSelectPool(pool.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 min-h-[44px] border
                      ${
                        selectedPoolId === pool.id
                          ? "bg-teal-400/20 border-teal-400/50 text-white"
                          : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                      }
                    `}
                  >
                    <img
                      src={getPoolIcon(pool)}
                      alt={`${pool.asset} logo`}
                      className="w-4 h-4 rounded flex-shrink-0"
                    />
                    <span className="font-bold text-sm flex-shrink-0">
                      {pool.asset}
                    </span>
                    <span className="text-teal-300 font-bold text-sm flex-shrink-0">
                      {Number(pool.ui.aprSupplyPct).toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Navigation */}
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 min-h-[40px]
                  ${
                    activeSection === item.id
                      ? "bg-teal-400 text-[#0c1a24]"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }
                `}
              >
                <span className="text-sm">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
