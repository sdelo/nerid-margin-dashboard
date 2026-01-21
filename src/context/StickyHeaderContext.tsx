import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface StickyHeaderContextType {
  navbarHeight: number;
  contextStripHeight: number;
  setNavbarHeight: (height: number) => void;
  setContextStripHeight: (height: number) => void;
  /** Total height of all sticky headers combined */
  totalStickyHeight: number;
  /** Height of just the navbar for first-level sticky elements */
  firstLevelTop: number;
  /** Height of navbar + context strip for second-level sticky elements */
  secondLevelTop: number;
}

const StickyHeaderContext = createContext<StickyHeaderContextType | null>(null);

/**
 * Provider that tracks sticky header heights and exposes them via CSS custom properties.
 * This allows child components to position sticky elements correctly without hardcoded values.
 */
export function StickyHeaderProvider({ children }: { children: React.ReactNode }) {
  const [navbarHeight, setNavbarHeight] = useState(56); // Default fallback
  const [contextStripHeight, setContextStripHeight] = useState(0);

  const totalStickyHeight = navbarHeight + contextStripHeight;
  const firstLevelTop = navbarHeight;
  const secondLevelTop = navbarHeight + contextStripHeight;

  // Update CSS custom properties whenever heights change
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--navbar-height", `${navbarHeight}px`);
    root.style.setProperty("--context-strip-height", `${contextStripHeight}px`);
    root.style.setProperty("--sticky-first-level", `${firstLevelTop}px`);
    root.style.setProperty("--sticky-second-level", `${secondLevelTop}px`);
    root.style.setProperty("--total-sticky-height", `${totalStickyHeight}px`);
  }, [navbarHeight, contextStripHeight, firstLevelTop, secondLevelTop, totalStickyHeight]);

  const handleSetNavbarHeight = useCallback((height: number) => {
    setNavbarHeight(height);
  }, []);

  const handleSetContextStripHeight = useCallback((height: number) => {
    setContextStripHeight(height);
  }, []);

  return (
    <StickyHeaderContext.Provider
      value={{
        navbarHeight,
        contextStripHeight,
        setNavbarHeight: handleSetNavbarHeight,
        setContextStripHeight: handleSetContextStripHeight,
        totalStickyHeight,
        firstLevelTop,
        secondLevelTop,
      }}
    >
      {children}
    </StickyHeaderContext.Provider>
  );
}

export function useStickyHeader() {
  const context = useContext(StickyHeaderContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      navbarHeight: 56,
      contextStripHeight: 0,
      setNavbarHeight: () => {},
      setContextStripHeight: () => {},
      totalStickyHeight: 56,
      firstLevelTop: 56,
      secondLevelTop: 56,
    };
  }
  return context;
}

/**
 * Hook to measure and register an element's height with the sticky header context.
 * Returns a ref to attach to the element.
 */
export function useStickyHeaderMeasure(type: "navbar" | "contextStrip") {
  const { setNavbarHeight, setContextStripHeight } = useStickyHeader();
  const ref = React.useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateHeight = () => {
      const height = element.getBoundingClientRect().height;
      if (type === "navbar") {
        setNavbarHeight(height);
      } else {
        setContextStripHeight(height);
      }
    };

    // Initial measurement
    updateHeight();

    // Set up ResizeObserver for dynamic changes
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(element);

    // Also listen to window resize for orientation changes
    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [type, setNavbarHeight, setContextStripHeight]);

  return ref;
}
