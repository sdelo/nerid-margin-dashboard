import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { PoolOverview } from "../features/lending/types";

export type UsePoolsUrlStateReturn = {
  /** Pool ID resolved from the `?pool=` asset name param, or null */
  urlPoolId: string | null;
  /** Current section from `?section=` (e.g. "risk", "yield", "activity", "concentration") */
  urlSection: string | null;
  /** Update the pool in the URL (uses asset name, not raw ID) */
  setUrlPool: (pool: PoolOverview) => void;
  /** Update the section in the URL */
  setUrlSection: (section: string | null) => void;
};

/**
 * Bidirectional sync between URL search params and pools page state.
 *
 * URL format: `/pools?pool=SUI&section=risk`
 *
 * - `pool`: asset name (SUI, USDC, DEEP, WAL) → resolved to pool ID via pools array
 * - `section`: section to deep-link to (e.g. "health", "yield", "risk", "activity",
 *              or sub-sections like "concentration", "liquidity", "liquidations")
 *
 * Uses `replaceState` (not pushState) for changes to avoid
 * polluting browser history with every interaction.
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
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setUrlSection = useCallback(
    (section: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (section) {
            next.set("section", section);
          } else {
            next.delete("section");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    urlPoolId,
    urlSection,
    setUrlPool,
    setUrlSection,
  };
}
