import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { PoolOverview } from "../features/lending/types";

export type TabKey = "overview" | "yield" | "risk" | "activity" | "howItWorks";

const VALID_TABS: TabKey[] = ["overview", "yield", "risk", "activity", "howItWorks"];

function isValidTab(value: string | null): value is TabKey {
  return value !== null && VALID_TABS.includes(value as TabKey);
}

export type UsePoolsUrlStateReturn = {
  /** Pool ID resolved from the `?pool=` asset name param, or null */
  urlPoolId: string | null;
  /** Current tab from `?tab=` */
  urlTab: TabKey;
  /** Current section from `?section=` */
  urlSection: string | null;
  /** Update the pool in the URL (uses asset name, not raw ID) */
  setUrlPool: (pool: PoolOverview) => void;
  /** Update the tab (and optionally section) in the URL */
  setUrlTab: (tab: TabKey, section?: string | null) => void;
  /** Clear tab and section from URL (go back to overview) */
  clearUrlTab: () => void;
};

/**
 * Bidirectional sync between URL search params and pools page state.
 *
 * URL format: `/pools?pool=SUI&tab=risk&section=liquidity`
 *
 * - `pool`: asset name (SUI, USDC, DEEP, WAL) → resolved to pool ID via pools array
 * - `tab`: one of overview | yield | risk | activity | howItWorks
 * - `section`: sub-section within a tab (e.g. "rates", "liquidity")
 *
 * Uses `replaceState` (not pushState) for pool/tab changes to avoid
 * polluting browser history with every tab click.
 */
export function usePoolsUrlState(pools: PoolOverview[]): UsePoolsUrlStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Read from URL ────────────────────────────────────────────────────

  const urlPoolId = useMemo(() => {
    const poolParam = searchParams.get("pool");
    if (!poolParam || pools.length === 0) return null;

    // Match by asset name (case-insensitive) first, then fall back to raw pool ID
    const match =
      pools.find((p) => p.asset.toLowerCase() === poolParam.toLowerCase()) ??
      pools.find((p) => p.id === poolParam);
    return match?.id ?? null;
  }, [searchParams, pools]);

  const urlTab = useMemo((): TabKey => {
    const tabParam = searchParams.get("tab");
    return isValidTab(tabParam) ? tabParam : "overview";
  }, [searchParams]);

  const urlSection = useMemo(() => {
    return searchParams.get("section");
  }, [searchParams]);

  // ── Write to URL ─────────────────────────────────────────────────────

  const setUrlPool = useCallback(
    (pool: PoolOverview) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("pool", pool.asset);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setUrlTab = useCallback(
    (tab: TabKey, section?: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === "overview") {
            next.delete("tab");
            next.delete("section");
          } else {
            next.set("tab", tab);
            if (section) {
              next.set("section", section);
            } else {
              next.delete("section");
            }
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const clearUrlTab = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("tab");
        next.delete("section");
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  return {
    urlPoolId,
    urlTab,
    urlSection,
    setUrlPool,
    setUrlTab,
    clearUrlTab,
  };
}
