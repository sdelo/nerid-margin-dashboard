import React from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { fetchUserCurrentSupply } from '../api/onChainReads';
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
 * Includes auto-retry polling when indexer data is not yet available.
 */
export function useEnrichedUserPositions(
  positions: UserPosition[],
  pools: PoolOverview[]
): EnrichedUserPosition[] {
  const suiClient = useSuiClient();
  const { network } = useAppNetwork();
  const [enrichedData, setEnrichedData] = React.useState<Map<string, EnrichedDataEntry>>(new Map());
  
  // Use ref to track in-flight requests to avoid duplicate fetching
  const inFlightRef = React.useRef<Set<string>>(new Set());
  
  // Use ref to access current enrichedData without adding it to dependencies
  const enrichedDataRef = React.useRef(enrichedData);
  enrichedDataRef.current = enrichedData;
  
  // Track retry timeouts so we can clear them on unmount
  const retryTimeoutsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  React.useEffect(() => {
    if (positions.length === 0 || pools.length === 0) {
      return;
    }

    // Process each position
    for (const position of positions) {
      const key = `${position.supplierCapId}-${position.asset}`;
      
      // Skip if already in flight
      if (inFlightRef.current.has(key)) {
        continue;
      }

      // Skip if already successfully loaded AND shares haven't changed
      const existingData = enrichedDataRef.current.get(key);
      if (existingData && !existingData.isLoading && existingData.currentValue !== null && existingData.originalValue !== null && !existingData.error) {
        // Check if shares changed (deposit/withdraw happened)
        if (existingData.shares === position.shares) {
          continue;
        }
      }

      // Find the pool for this position
      const pool = pools.find(p => p.asset === position.asset);
      if (!pool) {
        continue;
      }

      // Mark as in-flight
      inFlightRef.current.add(key);

      // Async IIFE to handle each position with retry logic
      (async () => {
        const fetchWithRetry = async (retryCount: number = 0) => {
          try {
            const contracts = getContracts(network);
            const packageId = contracts.MARGIN_PACKAGE_ID;

            // Fetch current value from chain
            const currentValue = await fetchUserCurrentSupply(
              suiClient,
              pool.contracts.marginPoolId,
              position.supplierCapId,
              pool.contracts.marginPoolType,
              packageId
            );

            // Calculate original value from events
            // Ensure shares is converted to BigInt properly (handles string or number)
            const sharesAsBigInt = typeof position.shares === 'bigint' 
              ? position.shares 
              : BigInt(Math.floor(Number(position.shares)));
              
            const originalValue = await fetchUserOriginalValue(
              position.supplierCapId,
              pool.contracts.marginPoolId,
              sharesAsBigInt
            );

            // Ensure all values are BigInt (convert if needed)
            const currentBigInt = currentValue !== null ? BigInt(currentValue) : null;
            const originalBigInt = originalValue !== null ? BigInt(originalValue) : null;
            
            // If originalValue is null but we have currentValue, and we haven't exceeded retries, schedule a retry
            if (currentBigInt !== null && originalBigInt === null && retryCount < MAX_RETRY_COUNT) {
              
              // Update state to show loading state (but with current value available)
              setEnrichedData(prev => {
                const next = new Map(prev);
                next.set(key, {
                  currentValue: currentBigInt,
                  originalValue: null,
                  isLoading: true, // Keep loading state during retries
                  error: null,
                  shares: position.shares,
                  retryCount: retryCount + 1,
                  lastRetryTime: Date.now(),
                });
                return next;
              });
              
              // Clear any existing timeout for this key
              const existingTimeout = retryTimeoutsRef.current.get(key);
              if (existingTimeout) {
                clearTimeout(existingTimeout);
              }
              
              // Schedule retry with exponential backoff (capped at MAX_RETRY_DELAY_MS)
              const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(1.5, retryCount), MAX_RETRY_DELAY_MS);
              const timeoutId = setTimeout(() => {
                retryTimeoutsRef.current.delete(key);
                fetchWithRetry(retryCount + 1);
              }, delay);
              retryTimeoutsRef.current.set(key, timeoutId);
              
              return; // Don't update state again, we'll do it in the retry
            }
            
            // Update state with final result
            setEnrichedData(prev => {
              const next = new Map(prev);
              next.set(key, {
                currentValue: currentBigInt,
                originalValue: originalBigInt,
                isLoading: false,
                error: null,
                shares: position.shares,
                retryCount: retryCount,
                lastRetryTime: Date.now(),
              });
              return next;
            });
          } catch (error) {
            
            setEnrichedData(prev => {
              const next = new Map(prev);
              next.set(key, {
                currentValue: null,
                originalValue: null,
                isLoading: false,
                error: error instanceof Error ? error : new Error(String(error)),
                shares: position.shares,
                retryCount: retryCount,
                lastRetryTime: Date.now(),
              });
              return next;
            });
          } finally {
            // Only remove from in-flight if we're not retrying
            if (retryCount === 0 || retryCount >= MAX_RETRY_COUNT) {
              inFlightRef.current.delete(key);
            }
          }
        };
        
        await fetchWithRetry(0);
      })();
    }
    
    // Cleanup function to clear retry timeouts on unmount
    return () => {
      retryTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      retryTimeoutsRef.current.clear();
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
        isLoading: inFlightRef.current.has(key),
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
