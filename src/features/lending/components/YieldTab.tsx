import React from "react";
import { SectionChips, type SectionConfig } from "../../../components/SectionChips";
import YieldCurve from "./YieldCurve";
import { APYHistory } from "./APYHistory";
import { BackedMarketsTab } from "./BackedMarketsTab";
import type { PoolOverview } from "../types";
import { useStickyHeader } from "../../../context/StickyHeaderContext";

interface YieldTabProps {
  pool: PoolOverview;
  pools: PoolOverview[];
  initialSection?: string | null;
  onMarketClick: (poolId: string) => void;
}

const SECTIONS: SectionConfig[] = [
  { id: "rates", label: "Rate Model" },
  { id: "history", label: "APY History" },
  { id: "markets", label: "Markets" },
];

/**
 * Consolidated Yield tab combining:
 * - Rate Model (utilization → supply/borrow curve)
 * - APY History (Supply APY, Borrow APY, Utilization over time)
 * - Markets / Deployment (where funds are used, exposures)
 */
export function YieldTab({
  pool,
  pools,
  initialSection,
  onMarketClick,
}: YieldTabProps) {
  const [activeSection, setActiveSection] = React.useState(initialSection || "rates");
  const [isChipsSticky, setIsChipsSticky] = React.useState(false);
  const [flashingSection, setFlashingSection] = React.useState<string | null>(null);
  const { secondLevelTop, totalStickyHeight } = useStickyHeader();
  
  // Track programmatic navigation to temporarily disable scrollspy
  const isNavigatingRef = React.useRef(false);
  const navigationTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  
  // Refs for each section
  const ratesRef = React.useRef<HTMLDivElement>(null);
  const historyRef = React.useRef<HTMLDivElement>(null);
  const marketsRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    rates: ratesRef,
    history: historyRef,
    markets: marketsRef,
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
    const totalHeaderHeight = totalStickyHeight + 50;
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
          // When sentinel leaves viewport (scrolled past), make chips sticky
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

  return (
    <div className="space-y-0">
      {/* Sentinel element: when this scrolls out of view, chips become sticky */}
      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      {/* Section Navigation - Always sticky, visual changes when stuck */}
      <div
        className={`
          sticky z-30 transition-all duration-200 py-2 -mx-6 px-6
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

      {/* SECTION: Rate Model */}
      <section 
        ref={ratesRef} 
        className={`scroll-mt-sticky pb-6 rounded-xl transition-all duration-300 ${
          flashingSection === "rates" 
            ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
            : ""
        }`}
      >
        <YieldCurve pool={pool} />
      </section>

      {/* SECTION: APY History */}
      <section 
        ref={historyRef} 
        className={`scroll-mt-sticky pb-6 rounded-xl transition-all duration-300 ${
          flashingSection === "history" 
            ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
            : ""
        }`}
      >
        <APYHistory pool={pool} />
      </section>

      {/* SECTION: Markets / Deployment */}
      <section 
        ref={marketsRef} 
        className={`scroll-mt-sticky pb-4 rounded-xl transition-all duration-300 ${
          flashingSection === "markets" 
            ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 bg-[#2dd4bf]/5" 
            : ""
        }`}
      >
        <BackedMarketsTab
          pool={pool}
          pools={pools}
          onMarketClick={onMarketClick}
        />
      </section>
    </div>
  );
}

export default YieldTab;
