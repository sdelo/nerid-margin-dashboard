/**
 * Event Transformation Utilities
 * 
 * Transform API JSON responses to chart-friendly formats and calculate derived metrics.
 * Handles type conversions, time bucketing, and aggregations.
 */

import type {
  AssetSuppliedEventResponse,
  AssetWithdrawnEventResponse,
  LoanBorrowedEventResponse,
  LoanRepaidEventResponse,
  LiquidationEventResponse,
  InterestParamsUpdatedEventResponse,
} from '../api/events';

/**
 * Time bucket for aggregating events
 */
export type TimeBucket = 'hour' | 'day' | 'week' | 'month';

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  time: string; // Formatted time string
  value: number;
}

/**
 * Supply/Borrow time series point
 */
export interface SupplyBorrowPoint extends TimeSeriesPoint {
  supply: number;
  borrow: number;
}

/**
 * Interest rate point
 */
export interface InterestRatePoint {
  timestamp: number;
  time: string;
  base_rate: number;
  base_slope: number;
  optimal_utilization: number;
  excess_slope: number;
}

/**
 * Convert timestamp (milliseconds) to formatted time string
 */
function formatTime(timestamp: number, bucket: TimeBucket = 'day'): string {
  const date = new Date(timestamp);
  
  switch (bucket) {
    case 'hour':
      return date.toISOString().slice(0, 13) + ':00:00Z';
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week':
      // Get start of week (Monday)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1);
      return weekStart.toISOString().slice(0, 10);
    case 'month':
      return date.toISOString().slice(0, 7);
    default:
      return date.toISOString();
  }
}

/**
 * Convert string to bigint, handling large numbers
 */
function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.floor(value));
  return BigInt(value);
}

/**
 * Convert from smallest units to human-readable format
 * Uses 9 decimals for rates, token-specific decimals for amounts
 */
export function convertFromSmallestUnits(
  value: string | number | bigint,
  decimals: number
): number {
  const divisor = BigInt(10 ** decimals);
  const numValue = toBigInt(value);
  return Number(numValue) / Number(divisor);
}

/**
 * Convert 9-decimal value to percentage
 */
export function nineDecimalToPercent(nineDecimal: string | number | bigint): number {
  return convertFromSmallestUnits(nineDecimal, 9) * 100;
}

/**
 * Aggregate supply/withdraw events into time series
 */
export function aggregateSupplyWithdrawEvents(
  supplied: AssetSuppliedEventResponse[],
  withdrawn: AssetWithdrawnEventResponse[],
  bucket: TimeBucket = 'day',
  decimals: number = 9 // Default to 9 for SUI, but should be passed per asset
): SupplyBorrowPoint[] {
  // Combine and sort by timestamp
  const events: Array<{
    timestamp: number;
    type: 'supply' | 'withdraw';
    amount: bigint;
  }> = [];

  supplied.forEach((event) => {
    events.push({
      timestamp: event.checkpoint_timestamp_ms,
      type: 'supply',
      amount: toBigInt(event.amount),
    });
  });

  withdrawn.forEach((event) => {
    events.push({
      timestamp: event.checkpoint_timestamp_ms,
      type: 'withdraw',
      amount: toBigInt(event.amount),
    });
  });

  // Sort by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);

  // Aggregate by time bucket
  const buckets = new Map<string, { supply: bigint; borrow: bigint }>();

  let runningSupply = 0n;
  let runningBorrow = 0n;

  events.forEach((event) => {
    const bucketKey = formatTime(event.timestamp, bucket);
    
    if (event.type === 'supply') {
      runningSupply += event.amount;
    } else {
      runningSupply -= event.amount;
    }

    // For now, borrow is 0 (we'd need loan events to calculate this)
    // This will be enhanced when we integrate loan events
    buckets.set(bucketKey, {
      supply: runningSupply,
      borrow: runningBorrow,
    });
  });

  // Convert to array of points
  const points: SupplyBorrowPoint[] = [];
  buckets.forEach((values, bucketKey) => {
    // Find the timestamp for this bucket (use first event in bucket)
    const bucketEvents = events.filter(
      (e) => formatTime(e.timestamp, bucket) === bucketKey
    );
    const timestamp = bucketEvents.length > 0
      ? bucketEvents[0]!.timestamp
      : Date.now();

    points.push({
      timestamp,
      time: bucketKey,
      value: convertFromSmallestUnits(values.supply, decimals),
      supply: convertFromSmallestUnits(values.supply, decimals),
      borrow: convertFromSmallestUnits(values.borrow, decimals),
    });
  });

  // Sort by timestamp
  points.sort((a, b) => a.timestamp - b.timestamp);

  return points;
}

/**
 * Aggregate loan events into time series
 */
export function aggregateLoanEvents(
  borrowed: LoanBorrowedEventResponse[],
  repaid: LoanRepaidEventResponse[],
  bucket: TimeBucket = 'day',
  decimals: number = 9
): TimeSeriesPoint[] {
  const events: Array<{
    timestamp: number;
    type: 'borrow' | 'repay';
    amount: bigint;
  }> = [];

  borrowed.forEach((event) => {
    events.push({
      timestamp: event.checkpoint_timestamp_ms,
      type: 'borrow',
      amount: toBigInt(event.loan_amount),
    });
  });

  repaid.forEach((event) => {
    events.push({
      timestamp: event.checkpoint_timestamp_ms,
      type: 'repay',
      amount: toBigInt(event.repay_amount),
    });
  });

  events.sort((a, b) => a.timestamp - b.timestamp);

  const buckets = new Map<string, bigint>();
  let runningTotal = 0n;

  events.forEach((event) => {
    const bucketKey = formatTime(event.timestamp, bucket);
    
    if (event.type === 'borrow') {
      runningTotal += event.amount;
    } else {
      runningTotal -= event.amount;
    }

    buckets.set(bucketKey, runningTotal);
  });

  const points: TimeSeriesPoint[] = [];
  buckets.forEach((value, bucketKey) => {
    const bucketEvents = events.filter(
      (e) => formatTime(e.timestamp, bucket) === bucketKey
    );
    const timestamp = bucketEvents.length > 0
      ? bucketEvents[0]!.timestamp
      : Date.now();

    points.push({
      timestamp,
      time: bucketKey,
      value: convertFromSmallestUnits(value, decimals),
    });
  });

  points.sort((a, b) => a.timestamp - b.timestamp);
  return points;
}

/**
 * Transform interest rate update events to time series
 */
export function transformInterestRateHistory(
  events: InterestParamsUpdatedEventResponse[]
): InterestRatePoint[] {
  return events
    .filter((event) => event.config_json || event.interest_config) // Check both fields
    .map((event) => {
      // Use config_json as primary field, fall back to interest_config for backwards compatibility
      const config = event.config_json || event.interest_config!;
      return {
        timestamp: event.checkpoint_timestamp_ms,
        time: new Date(event.checkpoint_timestamp_ms).toISOString(),
        base_rate: nineDecimalToPercent(config.base_rate),
        base_slope: nineDecimalToPercent(config.base_slope),
        optimal_utilization: nineDecimalToPercent(config.optimal_utilization),
        excess_slope: nineDecimalToPercent(config.excess_slope),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Calculate utilization from supply and borrow
 */
export function calculateUtilization(
  supply: bigint | string | number,
  borrow: bigint | string | number
): number {
  const supplyNum = toBigInt(supply);
  if (supplyNum === 0n) return 0;
  
  const borrowNum = toBigInt(borrow);
  return Number((borrowNum * 10000n) / supplyNum) / 100; // Return as percentage with 2 decimals
}

/**
 * Aggregate liquidation events for statistics
 */
export function aggregateLiquidationStats(
  events: LiquidationEventResponse[],
  decimals: number = 9
): {
  totalCount: number;
  totalValue: number;
  averageRiskRatio: number;
  events: Array<{
    timestamp: number;
    marginManagerId: string;
    marginPoolId: string;
    liquidationAmount: number;
    poolReward: number;
    riskRatio: number;
  }>;
} {
  if (events.length === 0) {
    return {
      totalCount: 0,
      totalValue: 0,
      averageRiskRatio: 0,
      events: [],
    };
  }

  let totalValue = 0n;
  let totalRiskRatio = 0n;

  const transformedEvents = events.map((event) => {
    const liquidationAmount = toBigInt(event.liquidation_amount);
    const poolReward = toBigInt(event.pool_reward);
    const riskRatio = toBigInt(event.risk_ratio);

    totalValue += liquidationAmount;
    totalRiskRatio += riskRatio;

    return {
      timestamp: event.checkpoint_timestamp_ms,
      marginManagerId: event.margin_manager_id,
      marginPoolId: event.margin_pool_id,
      liquidationAmount: convertFromSmallestUnits(liquidationAmount, decimals),
      poolReward: convertFromSmallestUnits(poolReward, decimals),
      riskRatio: convertFromSmallestUnits(riskRatio, 9), // Risk ratio uses 9 decimals
    };
  });

  return {
    totalCount: events.length,
    totalValue: convertFromSmallestUnits(totalValue, decimals),
    averageRiskRatio: convertFromSmallestUnits(
      totalRiskRatio / BigInt(events.length),
      9
    ),
    events: transformedEvents.sort((a, b) => b.timestamp - a.timestamp), // Most recent first
  };
}

