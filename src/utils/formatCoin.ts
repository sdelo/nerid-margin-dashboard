export function formatCoin(amount: string | number | bigint, decimals: number) {
  const value = BigInt(amount || 0);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = Number(value % divisor) / Number(divisor);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(Number(whole) + fraction);
}

