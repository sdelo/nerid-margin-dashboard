/**
 * Format a number with thousands separators
 */
export function formatNumber(n: number | bigint): string {
  return Intl.NumberFormat('en-US').format(Number(n));
}

/**
 * Format currency with consistent decimal places
 * For amounts >= $1000: show no decimals ($10,051)
 * For amounts < $1000: show 2 decimals ($31.40)
 */
export function formatCurrency(n: number | bigint): string {
  const num = Number(n);
  if (num >= 1000) {
    return Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
  }
  return Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

/**
 * Calculate utilization percentage from supply and borrow amounts
 */
export function utilizationPct(supply: number | bigint, borrow: number | bigint): number {
  const s = Number(supply);
  const b = Number(borrow);
  if (s === 0) return 0;
  return Number(((b / s) * 100).toFixed(2));
}
