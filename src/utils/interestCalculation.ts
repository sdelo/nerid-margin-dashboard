import type { UserPosition, PoolOverview } from '../features/lending/types';

/**
 * FLOAT_SCALING constant from deepbook (1e9)
 * This is used in the margin_state.move calculations
 */
const FLOAT_SCALING = 1_000_000_000n;

/**
 * Converts shares to balance using the formula from margin_state.move supply_shares_to_amount
 * Based on lines 127-151 of margin_state.move
 */
function convertSharesToBalance(
  shares: bigint,
  totalSupply: bigint,
  supplyShares: bigint,
  decimals: number
): number {
  const ratio = supplyShares === 0n 
    ? FLOAT_SCALING
    : (totalSupply * FLOAT_SCALING) / supplyShares;
  
  const balanceSmallUnits = (shares * ratio) / FLOAT_SCALING;
  return Number(balanceSmallUnits) / (10 ** decimals);
}

/**
 * Calculates interest earned for a user position
 * 
 * This is an approximation since we don't have event indexing to track
 * the exact deposit ratio at the time of deposit. We assume the deposit
 * ratio was close to 1.0 (FLOAT_SCALING) at deposit time.
 * 
 * Interest ≈ current_balance - (shares * 1.0)
 * 
 * For exact interest calculation, we would need to:
 * 1. Query AssetSupplied events to get deposit history
 * 2. Track the ratio at each deposit time
 * 3. Calculate interest based on the difference between current and deposit ratios
 */
export function calculateInterestEarned(
  position: UserPosition,
  poolData: PoolOverview
): string {
  const shares = BigInt(position.shares);
  const totalSupply = BigInt(Math.floor(poolData.state.supply * (10 ** poolData.contracts.coinDecimals)));
  const supplyShares = BigInt(Math.floor(poolData.state.supply_shares * (10 ** poolData.contracts.coinDecimals)));
  
  // Calculate current balance from shares
  const currentBalance = convertSharesToBalance(
    shares,
    totalSupply,
    supplyShares,
    poolData.contracts.coinDecimals
  );
  
  // Approximate original balance (assuming deposit ratio was ~1.0)
  const originalBalance = Number(shares) / (10 ** poolData.contracts.coinDecimals);
  
  // Interest earned is the difference
  const interestEarned = currentBalance - originalBalance;
  
  // Format the result
  const formattedInterest = interestEarned.toLocaleString();
  const asset = position.asset;
  
  return `${formattedInterest} ${asset}`;
}

/**
 * Calculates the current balance for a position using pool state
 * This is more accurate than the balanceFormatted from the position data
 * as it uses the latest pool state with accrued interest
 */
export function calculateCurrentBalance(
  position: UserPosition,
  poolData: PoolOverview
): string {
  const shares = BigInt(position.shares);
  const totalSupply = BigInt(Math.floor(poolData.state.supply * (10 ** poolData.contracts.coinDecimals)));
  const supplyShares = BigInt(Math.floor(poolData.state.supply_shares * (10 ** poolData.contracts.coinDecimals)));
  
  const currentBalance = convertSharesToBalance(
    shares,
    totalSupply,
    supplyShares,
    poolData.contracts.coinDecimals
  );
  
  const formattedBalance = currentBalance.toLocaleString();
  const asset = position.asset;
  
  return `${formattedBalance} ${asset}`;
}
