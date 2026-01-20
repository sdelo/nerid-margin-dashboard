import React from "react";
import { SectionChips, type SectionConfig } from "../../../components/SectionChips";
import { PoolRiskOutlook } from "./PoolRiskOutlook";
import { LiquidityTab } from "./LiquidityTab";
import { WhaleWatch } from "./WhaleWatch";
import { LiquidationWall } from "./LiquidationWall";
import type { PoolOverview } from "../types";

interface RiskTabProps {
  pool: PoolOverview;
  initialSection?: string | null;
}

const SECTIONS: SectionConfig[] = [
  { id: "overview", label: "Risk Overview" },
  { id: "liquidity", label: "Liquidity" },
  { id: "concentration", label: "Concentration" },
  { id: "liquidations", label: "Liquidations" },
];

/**
 * Consolidated Risk tab combining:
 * - Risk Summary strip (one-line verdict metrics)
 * - Liquidity (withdraw availability now + stress cases)
 * - Concentration (top suppliers/HHI, whale share)
 * - Liquidations (events over time + what triggers liquidations visuals)
 */
export function RiskTab({ pool, initialSection }: RiskTabProps) {
  const [activeSection, setActiveSection] = React.useState(initialSection || "overview");
  const [isChipsSticky, setIsChipsSticky] = React.useState(false);
  const [flashingSection, setFlashingSection] = React.useState<string | null>(null);
  
  // Track programmatic navigation to temporarily disable scrollspy
  const isNavigatingRef = React.useRef(false);
  const navigationTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Refs for each section
  const overviewRef = React.useRef<HTMLDivElement>(null);
  const liquidityRef = React.useRef<HTMLDivElement>(null);
  const concentrationRef = React.useRef<HTMLDivElement>(null);
  const liquidationsRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    overview: overviewRef,
    liquidity: liquidityRef,
    concentration: concentrationRef,
    liquidations: liquidationsRef,
  };

  // Helper to scroll to section with proper positioning and flash effect
  const scrollToSection = React.useCallback((sectionId: string, shouldFlash = false) => {
    const ref = sectionRefs[sectionId];
    if (!ref?.current) return;
    
    // Mark as navigating to prevent scrollspy from overriding
    isNavigatingRef.current = true;
    setActiveSection(sectionId);
    
    // Clear any existing navigation timeout
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Get the element's position relative to the document
    const element = ref.current;
    const elementRect = element.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.scrollY;
    
    // Calculate target scroll position to put element near top of viewport
    // Account for: navbar (~56px) + tab bar (~52px) + section chips (~44px) + some padding (~20px)
    const totalHeaderHeight = 172;
    const targetScrollPosition = absoluteElementTop - totalHeaderHeight;
    
    window.scrollTo({
      top: Math.max(0, targetScrollPosition),
      behavior: "smooth"
    });
    
    // Trigger flash effect after scroll animation starts
    if (shouldFlash) {
      setTimeout(() => {
        setFlashingSection(sectionId);
        setTimeout(() => setFlashingSection(null), 600);
      }, 300);
    }
    
    // Re-enable scrollspy after scroll animation completes
    navigationTimeoutRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1000);
  }, []);

  // Navigate to section when initialSection changes (e.g., from tile click)
  React.useEffect(() => {
    if (initialSection && sectionRefs[initialSection]) {
      // Use a longer delay to ensure the new tab content is fully rendered and measured
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          scrollToSection(initialSection, true); // Flash on tile click navigation
        });
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [initialSection, scrollToSection]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // Scroll to section when clicking chips
  const handleSectionClick = (sectionId: string) => {
    scrollToSection(sectionId, true); // Flash on chip click too
  };

  // Smart sticky: detect when we've scrolled past the sentinel
  React.useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // When sentinel leaves viewport (scrolled past), make chips sticky
          setIsChipsSticky(!entry.isIntersecting);
        });
      },
      { threshold: 0, rootMargin: "-60px 0px 0px 0px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  // Track active section on scroll using Intersection Observer (scrollspy)
  React.useEffect(() => {
    const observers: IntersectionObserver[] = [];

    Object.entries(sectionRefs).forEach(([id, ref]) => {
      if (!ref.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // Only update if not currently navigating programmatically
            // Use a lower threshold so sections near top of viewport are detected
            if (!isNavigatingRef.current && entry.isIntersecting && entry.intersectionRatio > 0.2) {
              setActiveSection(id);
            }
          });
        },
        // Adjusted rootMargin: less bottom margin so we detect sections when they're at top
        { threshold: [0.2, 0.4, 0.6], rootMargin: "-180px 0px -40% 0px" }
      );

      observer.observe(ref.current);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  // Quick summary stats for the strip
  const utilization = pool.state.supply > 0
    ? (pool.state.borrow / pool.state.supply) * 100
    : 0;
  const availableLiquidity = pool.state.supply - pool.state.borrow;

  const getUtilizationColor = (util: number) => {
    if (util > 80) return "text-red-400";
    if (util > 50) return "text-amber-400";
    return "text-emerald-400";
  };

  return (
    <div className="space-y-0">
      {/* Sentinel element: when this scrolls out of view, chips become sticky */}
      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      {/* Section Navigation - Smart Sticky Layer 2: sticks below navbar(56px) + tabs(52px) = 108px */}
      <div
        className={`
          z-30 -mx-6 px-6 transition-all duration-200
          ${isChipsSticky 
            ? "sticky top-[116px] py-1.5 bg-[#0d1a1f] backdrop-blur-xl border-b border-white/[0.06] shadow-md" 
            : "relative pb-3 pt-1"
          }
        `}
      >
        <SectionChips
          sections={SECTIONS}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
          isCompact={isChipsSticky}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: Risk Overview
      ═══════════════════════════════════════════════════════════════════ */}
      <section 
        ref={overviewRef} 
        className={`scroll-mt-44 pb-8 rounded-xl transition-all duration-300 ${
          flashingSection === "overview" 
            ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
            : ""
        }`}
      >
        {/* Quick Summary Strip */}
        <div className="flex items-center gap-4 p-3 mb-4 bg-gradient-to-r from-slate-800/60 to-transparent rounded-xl border border-slate-700/30">
          <div className="flex-1 flex items-center gap-6">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Available
              </span>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {availableLiquidity >= 1e6
                  ? `${(availableLiquidity / 1e6).toFixed(1)}M`
                  : availableLiquidity >= 1e3
                    ? `${(availableLiquidity / 1e3).toFixed(0)}K`
                    : availableLiquidity.toFixed(0)}
                <span className="text-xs text-slate-500 ml-1">{pool.asset}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Utilization
              </span>
              <div className={`text-lg font-bold font-mono ${getUtilizationColor(utilization)}`}>
                {utilization.toFixed(1)}%
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Total Supply
              </span>
              <div className="text-lg font-bold text-white font-mono">
                {pool.state.supply >= 1e6
                  ? `${(pool.state.supply / 1e6).toFixed(1)}M`
                  : pool.state.supply >= 1e3
                    ? `${(pool.state.supply / 1e3).toFixed(0)}K`
                    : pool.state.supply.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        <PoolRiskOutlook pool={pool} />
      </section>

      {/* SECTION: Liquidity */}
      <section 
        ref={liquidityRef} 
        className={`scroll-mt-44 pb-6 rounded-xl transition-all duration-300 ${
          flashingSection === "liquidity" 
            ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
            : ""
        }`}
      >
        <LiquidityTab pool={pool} />
      </section>

      {/* SECTION: Concentration */}
      <section 
        ref={concentrationRef} 
        className={`scroll-mt-44 pb-6 rounded-xl transition-all duration-300 ${
          flashingSection === "concentration" 
            ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
            : ""
        }`}
      >
        <WhaleWatch
          poolId={pool.contracts?.marginPoolId}
          decimals={pool.contracts?.coinDecimals}
          asset={pool.asset}
        />
      </section>

      {/* SECTION: Liquidations */}
      <section 
        ref={liquidationsRef} 
        className={`scroll-mt-44 pb-4 rounded-xl transition-all duration-300 ${
          flashingSection === "liquidations" 
            ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
            : ""
        }`}
      >
        <LiquidationWall
          poolId={pool.contracts?.marginPoolId}
          asset={pool.asset}
        />
      </section>
    </div>
  );
}

export default RiskTab;
