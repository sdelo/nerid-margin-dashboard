import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

/**
 * Referral tracker data returned from on-chain query
 */
export interface ReferralTrackerData {
  referralId: string;
  currentShares: bigint;
  unclaimedFees: bigint;
}

/**
 * Fetches referral tracker data for ALL referrals in a SINGLE batched
 * `devInspectTransactionBlock` RPC call.
 *
 * Before this optimisation each referral triggered its own RPC round-trip
 * (N referrals → N calls, 5 at a time). With this change:
 *   • 1 call to `margin_pool::protocol_fees` (shared across all referrals)
 *   • N calls to `protocol_fees::referral_tracker` chained in the same PTB
 *   • = 1 single RPC call total, regardless of referral count
 */
export async function fetchMultipleReferralTrackers(
  suiClient: SuiClient,
  poolId: string,
  referralIds: string[],
  assetType: string,
  packageId: string,
  _concurrency?: number, // kept for API compat, no longer used
): Promise<Map<string, ReferralTrackerData>> {
  const results = new Map<string, ReferralTrackerData>();
  if (referralIds.length === 0) return results;

  try {
    const tx = new Transaction();

    // One shared call: get protocol_fees reference from margin pool
    const protocolFeesRef = tx.moveCall({
      target: `${packageId}::margin_pool::protocol_fees`,
      arguments: [tx.object(poolId)],
      typeArguments: [assetType],
    });

    // Chain a referral_tracker call for EACH referral in the same transaction
    for (const referralId of referralIds) {
      tx.moveCall({
        target: `${packageId}::protocol_fees::referral_tracker`,
        arguments: [
          protocolFeesRef,
          tx.pure.id(referralId),
        ],
        typeArguments: [],
      });
    }

    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    if (result.effects.status.status !== 'success') {
      console.error('[fetchMultipleReferralTrackers] Transaction failed:', result.effects.status);
      return results;
    }

    // result.results layout:
    //   [0] → protocol_fees call (no useful return)
    //   [1] → referral_tracker for referralIds[0]
    //   [2] → referral_tracker for referralIds[1]
    //   …
    if (!result.results || result.results.length < 1 + referralIds.length) {
      console.error(
        '[fetchMultipleReferralTrackers] Unexpected result count:',
        result.results?.length,
        'expected',
        1 + referralIds.length,
      );
      return results;
    }

    for (let i = 0; i < referralIds.length; i++) {
      const entry = result.results[1 + i]; // skip index 0 (protocol_fees)
      const returnValues = entry?.returnValues;
      if (!returnValues || returnValues.length < 2) continue;

      const currentSharesBytes = returnValues[0][0];
      const unclaimedFeesBytes = returnValues[1][0];

      results.set(referralIds[i], {
        referralId: referralIds[i],
        currentShares: BigInt(bcs.U64.parse(new Uint8Array(currentSharesBytes))),
        unclaimedFees: BigInt(bcs.U64.parse(new Uint8Array(unclaimedFeesBytes))),
      });
    }
  } catch (error) {
    console.error('[fetchMultipleReferralTrackers] Error:', error);
  }

  return results;
}

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

/**
 * Position descriptor for batched supply fetching.
 */
export interface PositionDescriptor {
  poolId: string;
  supplierCapId: string;
  assetType: string;
}

/**
 * Fetches current supply amounts for MULTIPLE positions in a SINGLE
 * `devInspectTransactionBlock` RPC call. Each position adds one `user_supply_amount`
 * move call to the same PTB.
 *
 * @returns Map from supplierCapId → bigint (current supply in smallest units)
 */
export async function fetchMultipleUserCurrentSupply(
  suiClient: SuiClient,
  positions: PositionDescriptor[],
  packageId: string,
): Promise<Map<string, bigint>> {
  const results = new Map<string, bigint>();
  if (positions.length === 0) return results;

  try {
    const tx = new Transaction();

    for (const pos of positions) {
      tx.moveCall({
        target: `${packageId}::margin_pool::user_supply_amount`,
        arguments: [
          tx.object(pos.poolId),
          tx.pure.id(pos.supplierCapId),
          tx.object('0x6'), // Clock
        ],
        typeArguments: [pos.assetType],
      });
    }

    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    if (result.effects.status.status !== 'success') {
      return results;
    }

    if (!result.results) return results;

    for (let i = 0; i < positions.length; i++) {
      const entry = result.results[i];
      const returnValues = entry?.returnValues;
      if (!returnValues || returnValues.length === 0) continue;

      const returnValueBytes = returnValues[0][0];
      const value = BigInt(bcs.U64.parse(new Uint8Array(returnValueBytes)));
      results.set(positions[i].supplierCapId, value);
    }
  } catch (error) {
    console.error('[fetchMultipleUserCurrentSupply] Error:', error);
  }

  return results;
}
