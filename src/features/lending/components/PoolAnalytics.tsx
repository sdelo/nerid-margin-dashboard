import React from "react";
import { OverviewTiles } from "./OverviewTiles";

// Yield sub-components
import { YieldCurve } from "./YieldCurve";
import { APYHistory } from "./APYHistory";
import { BackedMarketsTab } from "./BackedMarketsTab";

// Risk sub-components
import { PoolRiskOutlook } from "./PoolRiskOutlook";
import { LiquidityTab } from "./LiquidityTab";
import { WhaleWatch } from "./WhaleWatch";
import { LiquidationWall } from "./LiquidationWall";

// Activity sub-components
import { PoolActivity } from "./PoolActivity";
import { BorrowRepayActivity } from "./BorrowRepayActivity";
import { UnifiedEventFeed } from "./UnifiedEventFeed";
import { WhaleComposition } from "./WhaleComposition";
import { ReferralActivity } from "./ReferralActivity";

import type { PoolOverview } from "../types";
import { useStickyHeader } from "../../../context/StickyHeaderContext";
import type { SectionGroup } from "../../../components/SectionChips";

// ── Canonical section config (exported so PoolsPage can render chips) ───
export const ANALYTICS_SECTIONS: SectionGroup[] = [
  {
    id: "health",
    label: "Overview",
    items: [{ id: "health", label: "Overview" }],
  },
  {
    id: "yield",
    label: "Yield",
    items: [
      { id: "rates", label: "Rate Model" },
      { id: "apy-history", label: "APY" },
      { id: "markets", label: "Markets" },
    ],
  },
  {
    id: "risk",
    label: "Risk",
    items: [
      { id: "risk-overview", label: "Risk" },
      { id: "liquidity", label: "Liquidity" },
      { id: "concentration", label: "Whales" },
      { id: "liquidations", label: "Liquidations" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    items: [
      { id: "supply-withdraw", label: "Supply" },
      { id: "borrow-repay", label: "Borrow" },
      { id: "event-feed", label: "Events" },
      { id: "composition", label: "Composition" },
      { id: "referrals", label: "Referrals" },
    ],
  },
];

/** Flat list of all section IDs (for quick look-ups) */
export const ALL_SECTION_IDS = ANALYTICS_SECTIONS.flatMap((g) =>
  g.items.map((i) => i.id),
);

/** Command object: { id: sectionId, n: monotonic counter } */
export interface ScrollCommand {
  id: string;
  n: number;
}

interface PoolAnalyticsProps {
  pool: PoolOverview;
  pools: PoolOverview[];
  /** Pass a new object (with incremented n) to trigger a scroll */
  scrollCommand?: ScrollCommand | null;
  /** Reported back as the user scrolls (scrollspy) */
  onActiveSectionChange?: (sectionId: string) => void;
  onMarketClick?: (poolId: string) => void;
}

/**
 * Unified single-scroll analytics panel.
 *
 * The section chip bar is now rendered externally (in PoolsPage's sticky header).
 * This component:
 *  • Renders all content inline
 *  • Reports the currently-visible section via onActiveSectionChange (scrollspy)
 *  • Scrolls to a section when scrollCommand changes
 */
export function PoolAnalytics({
  pool,
  pools,
  scrollCommand,
  onActiveSectionChange,
  onMarketClick,
}: PoolAnalyticsProps) {
  const { totalStickyHeight } = useStickyHeader();
  const [flashingSection, setFlashingSection] = React.useState<string | null>(null);
  const isNavigatingRef = React.useRef(false);
  const navigationTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  // ── Section refs ───────────────────────────────────────────────────────
  const healthRef = React.useRef<HTMLDivElement>(null);
  const ratesRef = React.useRef<HTMLDivElement>(null);
  const apyHistoryRef = React.useRef<HTMLDivElement>(null);
  const marketsRef = React.useRef<HTMLDivElement>(null);
  const riskOverviewRef = React.useRef<HTMLDivElement>(null);
  const liquidityRef = React.useRef<HTMLDivElement>(null);
  const concentrationRef = React.useRef<HTMLDivElement>(null);
  const liquidationsRef = React.useRef<HTMLDivElement>(null);
  const supplyWithdrawRef = React.useRef<HTMLDivElement>(null);
  const borrowRepayRef = React.useRef<HTMLDivElement>(null);
  const eventFeedRef = React.useRef<HTMLDivElement>(null);
  const compositionRef = React.useRef<HTMLDivElement>(null);
  const referralsRef = React.useRef<HTMLDivElement>(null);

  const allRefs: Record<string, React.RefObject<HTMLDivElement | null>> = React.useMemo(
    () => ({
      health: healthRef,
      rates: ratesRef,
      rateModel: ratesRef, // alias
      "apy-history": apyHistoryRef,
      apy: apyHistoryRef,
      history: apyHistoryRef,
      markets: marketsRef,
      "risk-overview": riskOverviewRef,
      liquidity: liquidityRef,
      concentration: concentrationRef,
      liquidations: liquidationsRef,
      "supply-withdraw": supplyWithdrawRef,
      "borrow-repay": borrowRepayRef,
      "event-feed": eventFeedRef,
      composition: compositionRef,
      referrals: referralsRef,
    }),
    [],
  );

  // ── Scroll helper ──────────────────────────────────────────────────────
  const scrollToRef = React.useCallback(
    (targetId: string, shouldFlash = true) => {
      const ref = allRefs[targetId];
      if (!ref?.current) return;

      isNavigatingRef.current = true;
      if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);

      const el = ref.current;
      const rect = el.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      // totalStickyHeight includes navbar + context strip; add ~48 for chips bar
      const headerOffset = totalStickyHeight + 52;
      window.scrollTo({ top: Math.max(0, absoluteTop - headerOffset), behavior: "smooth" });

      if (shouldFlash) {
        setTimeout(() => {
          setFlashingSection(targetId);
          setTimeout(() => setFlashingSection(null), 600);
        }, 300);
      }

      navigationTimeoutRef.current = setTimeout(() => {
        isNavigatingRef.current = false;
      }, 1000);
    },
    [totalStickyHeight, allRefs],
  );

  // ── React to scrollCommand prop changes ──────────────────────────────
  const lastCommandN = React.useRef(-1);
  React.useEffect(() => {
    if (scrollCommand && scrollCommand.n !== lastCommandN.current) {
      lastCommandN.current = scrollCommand.n;
      if (allRefs[scrollCommand.id]) {
        // Small delay to let any layout changes settle
        const id = setTimeout(() => scrollToRef(scrollCommand.id, true), 60);
        return () => clearTimeout(id);
      }
    }
  }, [scrollCommand, scrollToRef, allRefs]);

  // Cleanup
  React.useEffect(
    () => () => {
      if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
    },
    [],
  );

  // ── OverviewTiles tile click ──────────────────────────────────────────
  const handleTileClick = (tileId: string) => scrollToRef(tileId, true);

  // ── Scrollspy — track ALL sub-sections ────────────────────────────────
  React.useEffect(() => {
    // Only observe the canonical IDs (not aliases)
    const canonicalRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
      health: healthRef,
      rates: ratesRef,
      "apy-history": apyHistoryRef,
      markets: marketsRef,
      "risk-overview": riskOverviewRef,
      liquidity: liquidityRef,
      concentration: concentrationRef,
      liquidations: liquidationsRef,
      "supply-withdraw": supplyWithdrawRef,
      "borrow-repay": borrowRepayRef,
      "event-feed": eventFeedRef,
      composition: compositionRef,
      referrals: referralsRef,
    };

    const observers: IntersectionObserver[] = [];
    Object.entries(canonicalRefs).forEach(([id, ref]) => {
      if (!ref.current) return;
      const obs = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (!isNavigatingRef.current && entry.isIntersecting && entry.intersectionRatio > 0.15) {
              onActiveSectionChange?.(id);
            }
          }),
        { threshold: [0.15, 0.3, 0.5], rootMargin: "-160px 0px -40% 0px" },
      );
      obs.observe(ref.current);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [onActiveSectionChange]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const utilization = pool.state.supply > 0 ? (pool.state.borrow / pool.state.supply) * 100 : 0;
  const availableLiquidity = pool.state.supply - pool.state.borrow;
  const fmtNum = (n: number) => {
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return n.toFixed(0);
  };
  const utilColor = utilization > 80 ? "text-red-400" : utilization > 50 ? "text-amber-400" : "text-emerald-400";

  const flash = (id: string) =>
    flashingSection === id ? "ring-2 ring-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20 transition-shadow duration-300" : "";

  return (
    <div className="space-y-6">
      {/* ═══ HEALTH ═══════════════════════════════════════════════════════ */}
      <section
        ref={healthRef}
        className={`surface-elevated p-6 scroll-mt-sticky rounded-xl transition-all duration-300 ${flash("health")}`}
      >
        <OverviewTiles pool={pool} onSelectTab={handleTileClick} />
      </section>

      {/* ═══ YIELD ════════════════════════════════════════════════════════ */}
      <section className="surface-elevated p-6 scroll-mt-sticky rounded-xl">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Yield &amp; Rates</h2>
            <p className="text-xs text-white/40">Interest rate model, APY trends &amp; market deployments</p>
          </div>
        </div>

        <div className="space-y-8">
          <div ref={ratesRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("rates")}`}>
            <YieldCurve pool={pool} />
          </div>
          <div className="border-t border-white/[0.04]" />
          <div ref={apyHistoryRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("apy-history")}`}>
            <APYHistory pool={pool} />
          </div>
          <div className="border-t border-white/[0.04]" />
          <div ref={marketsRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("markets")}`}>
            <BackedMarketsTab pool={pool} pools={pools} onMarketClick={onMarketClick || (() => {})} />
          </div>
        </div>
      </section>

      {/* ═══ RISK ═════════════════════════════════════════════════════════ */}
      <section className="surface-elevated p-6 scroll-mt-sticky rounded-xl">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Risk &amp; Liquidity</h2>
            <p className="text-xs text-white/40">Pool health, concentration analysis &amp; liquidation history</p>
          </div>
        </div>

        {/* Quick summary strip */}
        <div className="flex items-center gap-4 p-3 mb-6 bg-gradient-to-r from-slate-800/60 to-transparent rounded-xl border border-slate-700/30">
          <div className="flex-1 flex items-center gap-6 flex-wrap">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Available</span>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {fmtNum(availableLiquidity)}
                <span className="text-xs text-slate-500 ml-1">{pool.asset}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Utilization</span>
              <div className={`text-lg font-bold font-mono ${utilColor}`}>{utilization.toFixed(1)}%</div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Supply</span>
              <div className="text-lg font-bold text-white font-mono">{fmtNum(pool.state.supply)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div ref={riskOverviewRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("risk-overview")}`}>
            <PoolRiskOutlook pool={pool} />
          </div>
          <div className="border-t border-white/[0.04]" />
          <div ref={liquidityRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("liquidity")}`}>
            <LiquidityTab pool={pool} />
          </div>
          <div className="border-t border-white/[0.04]" />
          <div ref={concentrationRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("concentration")}`}>
            <WhaleWatch
              poolId={pool.contracts?.marginPoolId}
              decimals={pool.contracts?.coinDecimals ?? 9}
              asset={pool.asset}
            />
          </div>
          <div className="border-t border-white/[0.04]" />
          <div ref={liquidationsRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("liquidations")}`}>
            <LiquidationWall poolId={pool.contracts?.marginPoolId} asset={pool.asset} />
          </div>
        </div>
      </section>

      {/* ═══ ACTIVITY ═════════════════════════════════════════════════════ */}
      <section className="surface-elevated p-6 scroll-mt-sticky rounded-xl">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Activity</h2>
            <p className="text-xs text-white/40">Supply/withdraw flows, borrowing, events &amp; whale movements</p>
          </div>
        </div>

        {/* Quick summary strip */}
        <div className="flex items-center gap-4 p-3 mb-6 bg-gradient-to-r from-slate-800/60 to-transparent rounded-xl border border-slate-700/30">
          <div className="flex-1 flex items-center gap-6 flex-wrap">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">TVL</span>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {fmtNum(pool.state.supply)}
                <span className="text-xs text-slate-500 ml-1">{pool.asset}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Borrowed</span>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {fmtNum(pool.state.borrow)}
                <span className="text-xs text-slate-500 ml-1">{pool.asset}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Utilization</span>
              <div className={`text-lg font-bold font-mono ${utilColor}`}>{utilization.toFixed(1)}%</div>
            </div>
            <div className="w-px h-8 bg-slate-700/50" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Available</span>
              <div className="text-lg font-bold text-white font-mono">{fmtNum(availableLiquidity)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div ref={supplyWithdrawRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("supply-withdraw")}`}>
            <PoolActivity pool={pool} />
          </div>
          <div className="border-t border-slate-700/30" />
          <div ref={borrowRepayRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("borrow-repay")}`}>
            <BorrowRepayActivity pool={pool} />
          </div>
          <div className="border-t border-slate-700/30" />
          <div ref={eventFeedRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("event-feed")}`}>
            <UnifiedEventFeed pool={pool} />
          </div>
          <div className="border-t border-slate-700/30" />
          <div ref={compositionRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("composition")}`}>
            <WhaleComposition pool={pool} />
          </div>
          <div className="border-t border-slate-700/30" />
          <div ref={referralsRef} className={`scroll-mt-sticky rounded-xl p-1 transition-all duration-300 ${flash("referrals")}`}>
            <ReferralActivity pool={pool} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default PoolAnalytics;
