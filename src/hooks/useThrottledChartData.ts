import { useRef, useState, useEffect, useMemo } from 'react';

/**
 * Hook to throttle chart data updates to prevent flickering.
 * 
 * This decouples "data ingest" from "chart render" by:
 * 1. Accepting new data as frequently as it arrives
 * 2. Only updating the output (chart data) on a calmer cadence
 * 3. Preserving the previous data during loading states
 * 
 * @param data - The raw data from React Query or other sources
 * @param options - Configuration options
 * @returns Throttled data that updates at a controlled rate
 */
export interface ThrottledChartDataOptions {
  /** Minimum time between updates in ms (default: 500ms = 2 updates/sec) */
  minUpdateInterval?: number;
  /** Whether to skip the initial delay (default: true) */
  immediateFirstRender?: boolean;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Custom comparison function to detect changes */
  isEqual?: (prev: unknown, next: unknown) => boolean;
}

export function useThrottledChartData<T>(
  data: T | undefined,
  options: ThrottledChartDataOptions = {}
): {
  data: T | undefined;
  isFirstRender: boolean;
  lastUpdateTime: number;
} {
  const {
    minUpdateInterval = 500, // 2 updates per second max
    immediateFirstRender = true,
    isLoading = false,
    isEqual = defaultIsEqual,
  } = options;

  // Track if this is the first render with data
  const hasReceivedDataRef = useRef(false);
  const [isFirstRender, setIsFirstRender] = useState(true);

  // Store the throttled output data
  const [throttledData, setThrottledData] = useState<T | undefined>(data);
  
  // Track last update time
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  
  // Pending update ref
  const pendingUpdateRef = useRef<T | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // If we don't have data yet, don't update
    if (data === undefined || data === null) {
      return;
    }

    // If loading, preserve existing data (don't flash to empty)
    if (isLoading && throttledData !== undefined) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    // First render with data - update immediately if configured
    if (!hasReceivedDataRef.current) {
      hasReceivedDataRef.current = true;
      if (immediateFirstRender) {
        setThrottledData(data);
        lastUpdateTimeRef.current = now;
        setLastUpdateTime(now);
        // Mark first render complete after a frame
        requestAnimationFrame(() => setIsFirstRender(false));
        return;
      }
    }

    // Check if data has actually changed
    if (isEqual(throttledData, data)) {
      return;
    }

    // If enough time has passed, update immediately
    if (timeSinceLastUpdate >= minUpdateInterval) {
      setThrottledData(data);
      lastUpdateTimeRef.current = now;
      setLastUpdateTime(now);
    } else {
      // Otherwise, queue the update
      pendingUpdateRef.current = data;
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Schedule update for when the interval has passed
      const delay = minUpdateInterval - timeSinceLastUpdate;
      timeoutRef.current = setTimeout(() => {
        if (pendingUpdateRef.current !== undefined) {
          setThrottledData(pendingUpdateRef.current);
          lastUpdateTimeRef.current = Date.now();
          setLastUpdateTime(Date.now());
          pendingUpdateRef.current = undefined;
        }
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, isLoading, minUpdateInterval, immediateFirstRender, isEqual, throttledData]);

  return {
    data: throttledData,
    isFirstRender,
    lastUpdateTime,
  };
}

/**
 * Default shallow comparison for arrays and objects
 */
function defaultIsEqual(prev: unknown, next: unknown): boolean {
  if (prev === next) return true;
  if (prev === undefined || next === undefined) return false;
  if (prev === null || next === null) return false;
  
  // For arrays, compare length and first/last elements as a quick check
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) return false;
    if (prev.length === 0) return true;
    // Compare stringified first and last items as a quick heuristic
    return (
      JSON.stringify(prev[0]) === JSON.stringify(next[0]) &&
      JSON.stringify(prev[prev.length - 1]) === JSON.stringify(next[next.length - 1])
    );
  }
  
  // For objects, do a shallow comparison
  if (typeof prev === 'object' && typeof next === 'object') {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) return false;
    return prevKeys.every(key => 
      (prev as Record<string, unknown>)[key] === (next as Record<string, unknown>)[key]
    );
  }
  
  return false;
}

/**
 * Hook specifically for React Query results with chart data
 * Combines loading state handling with throttling
 */
export function useThrottledQueryData<T>(
  queryResult: {
    data: T | undefined;
    isLoading: boolean;
    isFetching?: boolean;
    isRefetching?: boolean;
  },
  options: Omit<ThrottledChartDataOptions, 'isLoading'> = {}
): {
  data: T | undefined;
  isLoading: boolean;
  isFirstRender: boolean;
  isRefreshing: boolean;
} {
  const { data, isLoading, isFetching = false, isRefetching = false } = queryResult;
  
  // Only show loading on initial load, not refetches
  const isInitialLoading = isLoading && data === undefined;
  
  const throttled = useThrottledChartData(data, {
    ...options,
    isLoading: isInitialLoading,
  });

  return {
    data: throttled.data,
    isLoading: isInitialLoading && throttled.data === undefined,
    isFirstRender: throttled.isFirstRender,
    isRefreshing: (isFetching || isRefetching) && !isInitialLoading,
  };
}
