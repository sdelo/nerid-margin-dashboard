import React, { useRef, useMemo, useCallback } from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * Chart animation configuration that disables entrance animations after first mount.
 * Use these props on Recharts Area, Line, Bar components to prevent flicker.
 */
export interface StableAnimationProps {
  /** Whether this is the first render of the chart */
  isFirstRender: boolean;
  /** Animation duration for the first render (default: 800ms) */
  firstRenderDuration?: number;
  /** Animation duration for updates (default: 300ms for smooth transitions) */
  updateDuration?: number;
}

/**
 * Get animation props for Recharts components that prevent flicker on updates.
 * 
 * Usage:
 * ```tsx
 * const animationProps = getStableAnimationProps({ isFirstRender });
 * <Area {...animationProps} dataKey="value" />
 * ```
 */
export function getStableAnimationProps({
  isFirstRender,
  firstRenderDuration = 800,
  updateDuration = 300,
}: StableAnimationProps) {
  return {
    // Only play entrance animation on first render
    isAnimationActive: true,
    // Short duration for updates, longer for first render
    animationDuration: isFirstRender ? firstRenderDuration : updateDuration,
    // Use easeOut for smooth feel
    animationEasing: 'ease-out' as const,
    // Begin immediately (no stagger on updates)
    animationBegin: 0,
  };
}

/**
 * Get animation props that completely disable animation (for updates where you want instant change)
 */
export function getNoAnimationProps() {
  return {
    isAnimationActive: false,
    animationDuration: 0,
  };
}

/**
 * Props for charts that should have stable, non-flickering updates
 */
export interface StableChartContainerProps {
  /** The chart data - used to track if we have data for first render detection */
  data: unknown[] | undefined;
  /** Width of container (default: 100%) */
  width?: string | number;
  /** Height of container */
  height: number;
  /** Children render function that receives animation state */
  children: (props: {
    isFirstRender: boolean;
    animationProps: ReturnType<typeof getStableAnimationProps>;
  }) => React.ReactNode;
  /** Optional className for the container */
  className?: string;
}

/**
 * A container component for Recharts that handles stable rendering.
 * 
 * Features:
 * - Tracks first render state
 * - Provides animation props that prevent flicker
 * - Maintains stable identity across data updates
 * 
 * Usage:
 * ```tsx
 * <StableChartContainer data={chartData} height={280}>
 *   {({ animationProps }) => (
 *     <AreaChart data={chartData}>
 *       <Area {...animationProps} dataKey="value" />
 *     </AreaChart>
 *   )}
 * </StableChartContainer>
 * ```
 */
export function StableChartContainer({
  data,
  width = '100%',
  height,
  children,
  className,
}: StableChartContainerProps) {
  // Track if we've received data and completed first render
  const hasReceivedDataRef = useRef(false);
  const isFirstRenderRef = useRef(true);
  
  // Update refs based on data
  if (data && data.length > 0 && !hasReceivedDataRef.current) {
    hasReceivedDataRef.current = true;
  }
  
  // After first render with data, mark future renders as updates
  React.useEffect(() => {
    if (hasReceivedDataRef.current && isFirstRenderRef.current) {
      // Use a small delay to ensure animation completes
      const timeout = setTimeout(() => {
        isFirstRenderRef.current = false;
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [data]);
  
  const isFirstRender = isFirstRenderRef.current && hasReceivedDataRef.current;
  
  const animationProps = useMemo(
    () => getStableAnimationProps({ isFirstRender }),
    [isFirstRender]
  );
  
  return (
    <div className={className}>
      <ResponsiveContainer width={width} height={height}>
        {children({ isFirstRender, animationProps }) as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Hook to track first render state for charts.
 * Use this when you can't use StableChartContainer.
 */
export function useChartFirstRender(hasData: boolean): {
  isFirstRender: boolean;
  animationProps: ReturnType<typeof getStableAnimationProps>;
} {
  const hasSeenDataRef = useRef(false);
  const firstRenderCompleteRef = useRef(false);
  const [, forceUpdate] = React.useState({});
  
  // Track if we've seen data
  if (hasData && !hasSeenDataRef.current) {
    hasSeenDataRef.current = true;
  }
  
  // Mark first render complete after initial animation
  React.useEffect(() => {
    if (hasSeenDataRef.current && !firstRenderCompleteRef.current) {
      const timeout = setTimeout(() => {
        firstRenderCompleteRef.current = true;
        forceUpdate({});
      }, 850); // Slightly longer than animation duration
      return () => clearTimeout(timeout);
    }
  }, [hasData]);
  
  const isFirstRender = hasSeenDataRef.current && !firstRenderCompleteRef.current;
  
  const animationProps = useMemo(
    () => getStableAnimationProps({ isFirstRender }),
    [isFirstRender]
  );
  
  return { isFirstRender, animationProps };
}

/**
 * Generates a stable gradient ID that won't cause remounts.
 * Use this instead of inline gradient IDs that might change.
 */
export function useStableGradientId(prefix: string): string {
  const idRef = useRef<string>('');
  
  if (!idRef.current) {
    // Generate once on mount
    idRef.current = `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
  }
  
  return idRef.current;
}

/**
 * Hook to memoize chart data with stable references.
 * Prevents unnecessary re-renders when data content hasn't changed.
 */
export function useStableChartData<T extends Record<string, unknown>[]>(
  data: T | undefined
): T | undefined {
  const prevDataRef = useRef<T | undefined>(undefined);
  const stableDataRef = useRef<T | undefined>(undefined);
  
  // Only update stable data if content actually changed
  if (data !== prevDataRef.current) {
    prevDataRef.current = data;
    
    // Quick comparison: check length and first/last items
    const prevStable = stableDataRef.current;
    if (
      !prevStable ||
      !data ||
      prevStable.length !== data.length ||
      JSON.stringify(prevStable[0]) !== JSON.stringify(data[0]) ||
      JSON.stringify(prevStable[prevStable.length - 1]) !== JSON.stringify(data[data.length - 1])
    ) {
      stableDataRef.current = data;
    }
  }
  
  return stableDataRef.current;
}
