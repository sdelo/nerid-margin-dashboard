import { fetchAssetSupplied, fetchAssetWithdrawn, type AssetSuppliedEventResponse, type AssetWithdrawnEventResponse } from '../features/lending/api/events';

/**
 * Calculates the original value (cost basis) of user's CURRENT shares from blockchain events.
 * 
 * METHODOLOGY:
 * ============
 * The Move contract uses a share-based system where:
 * - When depositing: shares = amount / current_ratio
 * - When withdrawing: amount = shares × current_ratio  
 * - The ratio increases over time as interest accrues
 * - User's shares remain constant (unless they deposit/withdraw)
 * 
 * CALCULATING INTEREST:
 * ====================
 * To calculate "Interest Earned", we need:
 * - Current Value = shares × current_ratio (from user_supply_amount view function)
 * - Original Value = total amount paid for current shares (from events)
 * - Interest = Current Value - Original Value
 * 
 * WHY EVENTS ARE NECESSARY:
 * =========================
 * The contract does NOT store the ratio at which each user deposited. It only stores:
 * - User's current shares
 * - Pool's current ratio
 * 
 * To know what the user originally paid, we must look at AssetSupplied events which contain:
 * - supply_amount: tokens deposited
 * - supply_shares: shares received
 * 
 * For users with multiple deposits/withdrawals, we use weighted-average cost accounting.
 * 
 * @param supplierCapId - The supplier cap ID
 * @param poolId - The margin pool ID
 * @param currentShares - The user's current share balance (from on-chain)
 * @returns The original value of current shares in smallest units, or null if indexer unavailable
 */
export async function fetchUserOriginalValue(
  supplierCapId: string,
  poolId: string,
  currentShares: bigint
): Promise<bigint | null> {
  try {
    // Fetch supply AND withdrawal events IN PARALLEL (was sequential before)
    const [userSupplies, userWithdrawals] = await Promise.all([
      fetchAssetSupplied({
        margin_pool_id: poolId,
        supplier: supplierCapId,
        limit: 10000,
      }),
      fetchAssetWithdrawn({
        margin_pool_id: poolId,
        supplier: supplierCapId,
        limit: 10000,
      }),
    ]);
    
    if (userSupplies.length === 0) {
      return null; // Return null to indicate indexer data unavailable
    }
    
    return computeCostBasis(userSupplies, userWithdrawals, currentShares);
  } catch (error) {
    console.error('Error calculating user original value:', error);
    return null;
  }
}

/**
 * Pure cost-basis calculation shared by single and batch fetch.
 */
function computeCostBasis(
  supplies: AssetSuppliedEventResponse[],
  withdrawals: AssetWithdrawnEventResponse[],
  currentShares: bigint,
): bigint {
  let totalCost = 0n;
  let totalSharesAcquired = 0n;

  for (const event of supplies) {
    const sharesRaw = (event as any).supply_shares ?? (event as any).shares ?? '0';
    const amountRaw = (event as any).supply_amount ?? event.amount ?? '0';
    totalSharesAcquired += BigInt(String(sharesRaw));
    totalCost += BigInt(String(amountRaw));
  }

  let netShares = totalSharesAcquired;
  let netCost = totalCost;

  for (const event of withdrawals) {
    const sharesWithdrawnRaw = (event as any).withdraw_shares ?? (event as any).shares ?? '0';
    const sharesWithdrawn = BigInt(String(sharesWithdrawnRaw));
    if (netShares > 0n) {
      const costToRemove = (netCost * sharesWithdrawn) / netShares;
      netCost -= costToRemove;
      netShares -= sharesWithdrawn;
    }
  }

  if (netShares === 0n || netCost === 0n) return 0n;

  const SCALING = 1_000_000_000_000n;
  const avgCostPerShare = (netCost * SCALING) / netShares;
  return (currentShares * avgCostPerShare) / SCALING;
}

/**
 * Gets detailed history for a user position (all deposits and withdrawals)
 */
export async function fetchUserPositionHistory(
  supplierCapId: string,
  poolId: string
): Promise<{
  supplies: AssetSuppliedEventResponse[];
  withdrawals: AssetWithdrawnEventResponse[];
  netPrincipal: bigint;
} | null> {
  try {
    // Fetch supply and withdrawal events in parallel
    const [userSupplies, userWithdrawals] = await Promise.all([
      fetchAssetSupplied({
        margin_pool_id: poolId,
        supplier: supplierCapId,
        limit: 10000,
      }),
      fetchAssetWithdrawn({
        margin_pool_id: poolId,
        supplier: supplierCapId,
        limit: 10000,
      }),
    ]);
    
    // Calculate net principal
    const totalSupplied = userSupplies.reduce(
      (sum, event) => sum + BigInt((event as any).supply_amount || event.amount || 0),
      0n
    );
    
    const totalWithdrawn = userWithdrawals.reduce(
      (sum, event) => sum + BigInt((event as any).withdraw_amount || event.amount || 0),
      0n
    );
    
    const netPrincipal = totalSupplied - totalWithdrawn;
    
    return {
      supplies: userSupplies,
      withdrawals: userWithdrawals,
      netPrincipal,
    };
  } catch (error) {
    console.error('Error fetching user position history:', error);
    return null;
  }
}

