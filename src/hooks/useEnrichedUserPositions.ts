import React from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { fetchMultipleUserCurrentSupply, type PositionDescriptor } from '../api/onChainReads';
import { fetchUserOriginalValue } from '../api/userHistory';
import { getContracts } from '../config/contracts';
import { useAppNetwork } from '../context/AppNetworkContext';
import type { UserPosition, PoolOverview } from '../features/lending/types';

export type EnrichedUserPosition = UserPosition & {
  currentValueFromChain: string | null;
  originalValueFromEvents: string | null;
  interestEarned: string | null;
  isLoading: boolean;
  isIndexerPending: boolean; // True if we're still waiting for indexer data
  error: Error | null;
};

type EnrichedDataEntry = {
  currentValue: bigint | null;
  originalValue: bigint | null;
  isLoading: boolean;
  error: Error | null;
  shares: number;  // Track shares to detect when position changes
  retryCount: number; // Track retry attempts for indexer polling
  lastRetryTime: number; // Track when we last retried
};

// Constants for indexer retry polling
const MAX_RETRY_COUNT = 10;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 5000; // 5 seconds max

/**
 * Hook to enrich user positions with live on-chain data and event-based cost basis.
 * 
 * Optimised: all positions' `user_supply_amount` calls are batched into a SINGLE
 * `devInspectTransactionBlock` RPC call (via fetchMultipleUserCurrentSupply).
 * Indexer original-value lookups are fetched in parallel via Promise.all.
 * Includes auto-retry polling when indexer data is not yet available.
 */
export function useEnrichedUserPositions(
  positions: UserPosition[],
  pools: PoolOverview[]
): EnrichedUserPosition[] {
  const suiClient = useSuiClient();
  const { network } = useAppNetwork();
  const [enrichedData, setEnrichedData] = React.useState<Map<string, EnrichedDataEntry>>(new Map());
  
  // Use ref to track whether a batch fetch is already in-flight
  const inFlightRef = React.useRef(false);
  
  // Use ref to access current enrichedData without adding it to dependencies
  const enrichedDataRef = React.useRef(enrichedData);
  enrichedDataRef.current = enrichedData;
  
  // Track retry timeouts so we can clear them on unmount
  const retryTimeoutsRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (positions.length === 0 || pools.length === 0) {
      return;
    }

    // Determine which positions actually need fetching
    const positionsToFetch: { position: UserPosition; pool: PoolOverview; key: string }[] = [];
    for (const position of positions) {
      const key = `${position.supplierCapId}-${position.asset}`;
      const existingData = enrichedDataRef.current.get(key);
      // Skip if already successfully loaded AND shares haven't changed
      if (existingData && !existingData.isLoading && existingData.currentValue !== null && existingData.originalValue !== null && !existingData.error) {
        if (existingData.shares === position.shares) continue;
      }
      const pool = pools.find(p => p.asset === position.asset);
      if (!pool) continue;
      positionsToFetch.push({ position, pool, key });
    }

    if (positionsToFetch.length === 0 || inFlightRef.current) return;
    inFlightRef.current = true;

    const fetchBatch = async (retryCount: number = 0) => {
      try {
        const contracts = getContracts(network);
        const packageId = contracts.MARGIN_PACKAGE_ID;

        // ── 1. Batch ALL on-chain supply lookups into ONE RPC call ──
        const descriptors: PositionDescriptor[] = positionsToFetch.map(({ position, pool }) => ({
          poolId: pool.contracts.marginPoolId,
          supplierCapId: position.supplierCapId,
          assetType: pool.contracts.marginPoolType,
        }));

        const _t0 = performance.now();
        const currentValues = await fetchMultipleUserCurrentSupply(suiClient, descriptors, packageId);
        console.log(`⏱ [enrichedPositions] batched devInspect RPC: ${(performance.now() - _t0).toFixed(1)}ms`);

        // ── 2. Fetch original values from indexer (per-position, all in parallel) ──
        // Each fetchUserOriginalValue now runs supply + withdrawal in parallel
        // internally (Promise.all), and all positions run concurrently too.
        const _t1 = performance.now();
        const originalValueResults = await Promise.all(
          positionsToFetch.map(async ({ position, pool }) => {
            const sharesAsBigInt = typeof position.shares === 'bigint'
              ? position.shares
              : BigInt(Math.floor(Number(position.shares)));
            try {
              return await fetchUserOriginalValue(
                position.supplierCapId,
                pool.contracts.marginPoolId,
                sharesAsBigInt
              );
            } catch {
              return null;
            }
          })
        );
        console.log(`⏱ [enrichedPositions] original values from indexer: ${(performance.now() - _t1).toFixed(1)}ms`);

        // ── 3. Check if any positions need indexer retries ──
        let needsRetry = false;

        setEnrichedData(prev => {
          const next = new Map(prev);
          positionsToFetch.forEach(({ position, key }, idx) => {
            const currentBigInt = currentValues.get(position.supplierCapId) ?? null;
            const rawOriginal = originalValueResults[idx];
            const originalBigInt = rawOriginal !== null ? BigInt(rawOriginal) : null;

            if (currentBigInt !== null && originalBigInt === null && retryCount < MAX_RETRY_COUNT) {
              needsRetry = true;
            }

            const isStillLoading = currentBigInt !== null && originalBigInt === null && retryCount < MAX_RETRY_COUNT;

            next.set(key, {
              currentValue: currentBigInt,
              originalValue: originalBigInt,
              isLoading: isStillLoading,
              error: null,
              shares: position.shares,
              retryCount: retryCount,
              lastRetryTime: Date.now(),
            });
          });
          return next;
        });

        if (needsRetry) {
          const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(1.5, retryCount), MAX_RETRY_DELAY_MS);
          retryTimeoutsRef.current = setTimeout(() => {
            fetchBatch(retryCount + 1);
          }, delay);
        } else {
          inFlightRef.current = false;
        }
      } catch (error) {
        setEnrichedData(prev => {
          const next = new Map(prev);
          positionsToFetch.forEach(({ position, key }) => {
            next.set(key, {
              currentValue: null,
              originalValue: null,
              isLoading: false,
              error: error instanceof Error ? error : new Error(String(error)),
              shares: position.shares,
              retryCount,
              lastRetryTime: Date.now(),
            });
          });
          return next;
        });
        inFlightRef.current = false;
      }
    };

    fetchBatch(0);
    
    // Cleanup function to clear retry timeouts on unmount
    return () => {
      if (retryTimeoutsRef.current) {
        clearTimeout(retryTimeoutsRef.current);
        retryTimeoutsRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [positions, pools, suiClient, network]);

  // Merge the enriched data with positions
  return positions.map(position => {
    const key = `${position.supplierCapId}-${position.asset}`;
    const enriched = enrichedData.get(key);
    const pool = pools.find(p => p.asset === position.asset);

    if (!enriched || !pool) {
      return {
        ...position,
        currentValueFromChain: null,
        originalValueFromEvents: null,
        interestEarned: null,
        isLoading: inFlightRef.current,
        isIndexerPending: false,
        error: null,
      };
    }

    // Format the values
    const decimals = pool.contracts.coinDecimals;
    const divisor = 10 ** decimals;
    
    const currentValueFormatted = enriched.currentValue !== null
      ? (Number(enriched.currentValue) / divisor).toLocaleString() + ` ${position.asset}`
      : null;
    
    const originalValueFormatted = enriched.originalValue !== null
      ? (Number(enriched.originalValue) / divisor).toLocaleString() + ` ${position.asset}`
      : null;

    // Check if we're still waiting for indexer (have current value but not original)
    const isIndexerPending = enriched.currentValue !== null && 
                             enriched.originalValue === null && 
                             enriched.retryCount < MAX_RETRY_COUNT;

    // Calculate interest earned
    let interestEarnedFormatted: string | null = null;
    
    if (enriched.currentValue !== null && enriched.originalValue !== null) {
      // Both values available - calculate interest
      const interestAmount = (Number(enriched.currentValue) - Number(enriched.originalValue)) / divisor;
      
      // Format based on the size of the interest
      // For very small amounts, use more decimal places
      let formattedInterest: string;
      if (Math.abs(interestAmount) < 0.0001) {
        // Very small - show in scientific notation or full precision
        formattedInterest = interestAmount.toFixed(9).replace(/\.?0+$/, '');
        if (formattedInterest === '0' || formattedInterest === '-0') {
          formattedInterest = interestAmount.toExponential(4);
        }
      } else if (Math.abs(interestAmount) < 0.01) {
        // Small - show 6 decimals
        formattedInterest = interestAmount.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 6,
        });
      } else {
        // Normal - show 4 decimals
        formattedInterest = interestAmount.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 4,
        });
      }
      interestEarnedFormatted = formattedInterest + ` ${position.asset}`;
    } else if (isIndexerPending || enriched.isLoading) {
      // Still loading or waiting for indexer - show null to trigger loading state in UI
      interestEarnedFormatted = null;
    } else if (enriched.currentValue !== null && enriched.originalValue === null) {
      // Retries exhausted but still no indexer data - show dash
      interestEarnedFormatted = '—';
    } else {
      interestEarnedFormatted = null;
    }

    return {
      ...position,
      currentValueFromChain: currentValueFormatted,
      originalValueFromEvents: originalValueFormatted,
      interestEarned: interestEarnedFormatted,
      isLoading: enriched.isLoading || isIndexerPending,
      isIndexerPending,
      error: enriched.error,
    };
  });
}
