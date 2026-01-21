import React from "react";
import { SectionChips, type SectionConfig } from "../../../components/SectionChips";
import { PoolActivity } from "./PoolActivity";
import { BorrowRepayActivity } from "./BorrowRepayActivity";
import { UnifiedEventFeed } from "./UnifiedEventFeed";
import { WhaleComposition } from "./WhaleComposition";
import type { PoolOverview } from "../types";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useStickyHeader } from "../../../context/StickyHeaderContext";

interface ActivityTabProps {
  pool: PoolOverview;
  initialSection?: string | null;
}

const SECTIONS: SectionConfig[] = [
  { id: "supply-withdraw", label: "Supply & Withdraw" },
  { id: "borrow-repay", label: "Borrow & Repay" },
  { id: "event-feed", label: "Event Feed" },
  { id: "composition", label: "Whale Watch" },
];

/**
 * Consolidated Activity tab showing:
 * - Supply/Withdraw flows (TVL changes)
 * - Borrow/Repay activity (debt changes, utilization drivers)
 * - Unified on-chain event feed (all events with filters + tx links)
 * - Whale/composition views (size buckets, inflow/outflow, churn)
 * 
 * Each section includes "What This Tells You" interpretation guides.
 */
export function ActivityTab({ pool, initialSection }: ActivityTabProps) {
  const [activeSection, setActiveSection] = React.useState(initialSection || "supply-withdraw");
  const [isChipsSticky, setIsChipsSticky] = React.useState(false);
  const [flashingSection, setFlashingSection] = React.useState<string | null>(null);
  const { secondLevelTop, totalStickyHeight } = useStickyHeader();
  
  // Track programmatic navigation to temporarily disable scrollspy
  const isNavigatingRef = React.useRef(false);
  const navigationTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Refs for each section
  const supplyWithdrawRef = React.useRef<HTMLDivElement>(null);
  const borrowRepayRef = React.useRef<HTMLDivElement>(null);
  const eventFeedRef = React.useRef<HTMLDivElement>(null);
  const compositionRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    "supply-withdraw": supplyWithdrawRef,
    "borrow-repay": borrowRepayRef,
    "event-feed": eventFeedRef,
    composition: compositionRef,
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
    // Uses dynamic total sticky height from context + some padding for section chips (~50px)
    const totalHeaderHeightCalc = totalStickyHeight + 50;
    const targetScrollPosition = absoluteElementTop - totalHeaderHeightCalc;
    
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
          scrollToSection(initialSection, true);
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
    scrollToSection(sectionId, true);
  };

  // Smart sticky: detect when we've scrolled past the sentinel
  // Uses dynamic header height so it works on all viewport sizes
  React.useEffect(() => {
    if (!sentinelRef.current) return;

    // Root margin uses the total sticky height so chips become sticky
    // exactly when they would hit the bottom of the sticky headers
    const rootMarginTop = -(totalStickyHeight + 10); // +10px buffer
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsChipsSticky(!entry.isIntersecting);
        });
      },
      { threshold: 0, rootMargin: `${rootMarginTop}px 0px 0px 0px` }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [totalStickyHeight]); // Re-create observer when header height changes

  // Track active section on scroll using Intersection Observer (scrollspy)
  React.useEffect(() => {
    const observers: IntersectionObserver[] = [];

    Object.entries(sectionRefs).forEach(([id, ref]) => {
      if (!ref.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // Only update if not currently navigating programmatically
            if (!isNavigatingRef.current && entry.isIntersecting && entry.intersectionRatio > 0.2) {
              setActiveSection(id);
            }
          });
        },
        { threshold: [0.2, 0.4, 0.6], rootMargin: "-200px 0px -40% 0px" }
      );

      observer.observe(ref.current);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  // Quick summary for the header strip
  const utilization = pool.state.supply > 0
    ? (pool.state.borrow / pool.state.supply) * 100
    : 0;

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(0) + "K";
    return num.toFixed(0);
  };

  return (
    <div className="space-y-0">
      {/* Sentinel element: when this scrolls out of view, chips become sticky */}
      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      {/* Section Navigation - Sticky at viewport level (outside any card container) */}
      <div
        className={`
          sticky z-30 transition-all duration-200 py-2
          ${isChipsSticky 
            ? "bg-[#0d1a1f]/98 border-b border-white/[0.06] shadow-md backdrop-blur-md" 
            : "bg-[#0d1a1f]"
          }
        `}
        style={{ top: `${totalStickyHeight}px` }}
      >
        <SectionChips
          sections={SECTIONS}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
          isCompact={isChipsSticky}
        />
      </div>

      {/* Section content wrapped in card for visual styling */}
      <div className="surface-elevated px-6 pb-6 pt-4 mt-2">
        {/* ═══════════════════════════════════════════════════════════════════
            Quick Summary Strip
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-4 p-3 mb-4 bg-gradient-to-r from-slate-800/60 to-transparent rounded-xl border border-slate-700/30">
          <div className="flex-1 flex items-center gap-6">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                TVL
              </span>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {formatNumber(pool.state.supply)}
                <span className="text-xs text-slate-500 ml-1">{pool.asset}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Borrowed
              </span>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {formatNumber(pool.state.borrow)}
                <span className="text-xs text-slate-500 ml-1">{pool.asset}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Utilization
              </span>
              <div className={`text-lg font-bold font-mono ${
                utilization > 80 ? "text-red-400" : utilization > 50 ? "text-amber-400" : "text-emerald-400"
              }`}>
                {utilization.toFixed(1)}%
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Available
              </span>
              <div className="text-lg font-bold text-white font-mono">
                {formatNumber(pool.state.supply - pool.state.borrow)}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: Supply & Withdraw Activity
        ═══════════════════════════════════════════════════════════════════ */}
        <section 
          ref={supplyWithdrawRef} 
          className={`scroll-mt-sticky pb-8 rounded-xl transition-all duration-300 ${
            flashingSection === "supply-withdraw" 
              ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
              : ""
          }`}
        >
          <PoolActivity pool={pool} />
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: Borrow & Repay Activity
        ═══════════════════════════════════════════════════════════════════ */}
        <section 
          ref={borrowRepayRef} 
          className={`scroll-mt-sticky pb-8 border-t border-slate-700/30 pt-6 rounded-xl transition-all duration-300 ${
            flashingSection === "borrow-repay" 
              ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
              : ""
          }`}
        >
          <BorrowRepayActivity pool={pool} />
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: Unified Event Feed
        ═══════════════════════════════════════════════════════════════════ */}
        <section 
          ref={eventFeedRef} 
          className={`scroll-mt-sticky pb-8 border-t border-slate-700/30 pt-6 rounded-xl transition-all duration-300 ${
            flashingSection === "event-feed" 
              ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
              : ""
          }`}
        >
          <UnifiedEventFeed pool={pool} />
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: Whale & Composition
        ═══════════════════════════════════════════════════════════════════ */}
        <section 
          ref={compositionRef} 
          className={`scroll-mt-sticky pb-4 border-t border-slate-700/30 pt-6 rounded-xl transition-all duration-300 ${
            flashingSection === "composition" 
              ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
              : ""
          }`}
        >
          <WhaleComposition pool={pool} />
        </section>
      </div>
    </div>
  );
}

export default ActivityTab;
