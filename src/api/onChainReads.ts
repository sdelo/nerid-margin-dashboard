import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

/**
 * Fetches the current supply amount for a user position using on-chain view function.
 * This calls the Move contract's `user_supply_amount` function which returns the 
 * accurate current value (Principal + Accrued Interest) for a given supplier cap.
 * 
 * @param suiClient - The Sui client instance
 * @param poolId - The margin pool ID
 * @param supplierCapId - The supplier cap ID (used as key to lookup position)
 * @param assetType - The asset type (e.g., "0x2::sui::SUI")
 * @param packageId - The deepbook margin package ID
 * @returns The current supply amount in smallest units (u64), or null if error
 */
export async function fetchUserCurrentSupply(
  suiClient: SuiClient,
  poolId: string,
  supplierCapId: string,
  assetType: string,
  packageId: string
): Promise<bigint | null> {
  try {
    // Create a transaction to call the view function
    const tx = new Transaction();
    
    // Call user_supply_amount(pool, supplier_cap_id, clock)
    // The function signature is: public fun user_supply_amount<Asset>(self: &MarginPool<Asset>, supplier_cap_id: ID, clock: &Clock): u64
    tx.moveCall({
      target: `${packageId}::margin_pool::user_supply_amount`,
      arguments: [
        tx.object(poolId),           // pool reference
        tx.pure.id(supplierCapId),   // supplier_cap_id as ID
        tx.object('0x6'),            // Clock object
      ],
      typeArguments: [assetType],
    });
    
    // Execute the transaction in dev inspect mode (read-only, no gas cost)
    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000', // Dummy sender for dev inspect
    });
    
    // Check if the transaction was successful
    if (result.effects.status.status !== 'success') {
      return null;
    }
    
    // Parse the return value from the first result
    if (!result.results || result.results.length === 0) {
      return null;
    }
    
    const returnValues = result.results[0]?.returnValues;
    
    if (!returnValues || returnValues.length === 0) {
      return null;
    }
    
    // The return value is a BCS-encoded u64
    // Structure: [[bytes, typeTag], ...]
    const firstReturnValue = returnValues[0];
    const returnValueBytes = firstReturnValue[0];
    
    const currentSupplyRaw = bcs.U64.parse(new Uint8Array(returnValueBytes));
    // Ensure we always return a BigInt (bcs.U64.parse may return number in some SDK versions)
    const currentSupply = BigInt(currentSupplyRaw);
    
    return currentSupply;
  } catch {
    return null;
  }
}
