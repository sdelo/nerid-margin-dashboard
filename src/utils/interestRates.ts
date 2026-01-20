import type { PoolOverview } from '../features/lending/types';

/**
 * Converts basis points (with 2 decimals) to percentage
 * Example: 200 basis points = 2.00%
 */
export function basisPointsToPercent(basisPoints: number): number {
  return Number(basisPoints) / 100;
}

/**
 * Values are already converted from 9-decimal format to decimal in poolDataTransform.ts
 * This function converts decimal to percentage for calculations
 * Example: 0.9 (decimal) = 90.0 (percentage)
 */
export function nineDecimalToPercent(value: number): number {
  return value * 100;
}

/**
 * Converts percentage to display percentage (multiplies by 100)
 * Example: 0.9 (90%) = 90.0% (for display)
 */
export function nineDecimalToDisplayPercent(value: number): number {
  return value * 100;
}


/**
 * Calculates utilization percentage from supply and borrow number*/
export function calculateUtilizationPct(supply: number, borrow: number): number {
  if (supply === 0) return 0;
  return Number((borrow * 10000) / supply) / 100; // Convert to percentage with 2 decimals
}

/**
 * Calculates borrow APR based on utilization and interest config
 */
export function calculateBorrowApr(
  utilizationPct: number,
  baseRate: number,
  baseSlope: number,
  optimalUtilization: number,
  excessSlope: number
): number {
  const u = utilizationPct / 100; // Convert to decimal
  const baseRatePct = nineDecimalToPercent(baseRate);
  const baseSlopePct = nineDecimalToPercent(baseSlope);
  const optimalPct = nineDecimalToPercent(optimalUtilization);
  const optimalU = optimalPct / 100;
  const excessSlopePct = nineDecimalToPercent(excessSlope);

  return u <= optimalU
    ? baseRatePct + baseSlopePct * u
    : baseRatePct + baseSlopePct * optimalU + excessSlopePct * (u - optimalU);
}

/**
 * Calculates supply APR based on borrow APR, utilization, and protocol spread
 */
export function calculateSupplyApr(
  borrowApr: number,
  utilizationPct: number,
  protocolSpread: number
): number {
  const u = utilizationPct / 100;
  const spreadPct = nineDecimalToPercent(protocolSpread); // Convert from 9-decimal format
  return borrowApr * u * (1 - spreadPct / 100);
}

/**
 * Calculates all interest rates for a pool
 */
export function calculatePoolRates(pool: PoolOverview): {
  utilizationPct: number;
  borrowApr: number;
  supplyApr: number;
} {
  const { state, protocolConfig } = pool;
  const ic = protocolConfig.interest_config;
  const mc = protocolConfig.margin_pool_config;

  const utilizationPct = calculateUtilizationPct(
    state.supply,
    state.borrow
  );

  const borrowApr = calculateBorrowApr(
    utilizationPct,
    ic.base_rate,
    ic.base_slope,
    ic.optimal_utilization,
    ic.excess_slope
  );

  const supplyApr = calculateSupplyApr(
    borrowApr,
    utilizationPct,
    mc.protocol_spread
  );

  return {
    utilizationPct,
    borrowApr,
    supplyApr,
  };
}
