import { SuiClient } from '@mysten/sui/client';
import { MarginPool } from '../contracts/deepbook_margin/deepbook_margin/margin_pool';
import { getContracts, getMarginPools, type NetworkType } from '../config/contracts';
import type { UserPosition, PoolAssetSymbol } from '../features/lending/types';

/**
 * Converts shares to balance using the formula from margin_state.move supply_shares_to_amount
 * Based on lines 127-151 of margin_state.move
 */
function convertSharesToBalance(
  shares: bigint,
  totalSupply: bigint,
  supplyShares: bigint,
  decimals: number,
  asset: PoolAssetSymbol
): string {
  // FLOAT_SCALING constant from deepbook (1e9)
  const FLOAT_SCALING = 1_000_000_000n;
  
  const ratio = supplyShares === 0n 
    ? FLOAT_SCALING
    : (totalSupply * FLOAT_SCALING) / supplyShares;
  
  const balanceSmallUnits = (shares * ratio) / FLOAT_SCALING;
  const balance = Number(balanceSmallUnits) / (10 ** decimals);
  
  return `${balance.toLocaleString()} ${asset}`;
}

/**
 * Extracts shares value from dynamic field content structure
 * Handles the nested structure: Field<address, Position> -> Position -> shares
 */
function extractSharesFromDynamicField(content: any): string | number | null {
  // Standard structure: content.fields.value.fields.shares
  const fields = content?.fields;
  const value = fields?.value;
  const valueFields = value?.fields;
  
  if (valueFields?.shares !== undefined) {
    return valueFields.shares;
  }
  
  // Fallback patterns
  if (value?.shares !== undefined) {
    return value.shares;
  }
  
  if (content?.value?.fields?.shares !== undefined) {
    return content.value.fields.shares;
  }
  
  return null;
}

/**
 * Helper to find all user's SupplierCaps for a given package
 */
async function getAllSupplierCaps(
  client: SuiClient,
  owner: string,
  packageId: string
): Promise<string[]> {
  const capType = `${packageId}::margin_pool::SupplierCap`;
  const caps = await client.getOwnedObjects({
    owner,
    filter: { StructType: capType },
  });
  
  return caps.data
    .map((cap) => cap.data?.objectId)
    .filter((id): id is string => id !== undefined && id !== null);
}

/** Pre-parsed pool data used to avoid redundant getObject calls */
interface ParsedPoolData {
  positionTableId: string;
  totalSupply: bigint;
  supplyShares: bigint;
}

/**
 * Fetches a user's position from a specific margin pool for a given SupplierCap.
 * Accepts pre-parsed pool data to avoid a redundant getObject call.
 */
export async function fetchUserPositionFromPool(
  suiClient: SuiClient,
  poolId: string,
  userAddress: string,
  asset: PoolAssetSymbol,
  decimals: number,
  supplierCapId: string,
  parsedPoolData?: ParsedPoolData
): Promise<UserPosition | null> {
  try {
    let positionTableId: string;
    let totalSupply: bigint;
    let supplyShares: bigint;

    if (parsedPoolData) {
      // Use pre-parsed data (from batched multiGetObjects)
      positionTableId = parsedPoolData.positionTableId;
      totalSupply = parsedPoolData.totalSupply;
      supplyShares = parsedPoolData.supplyShares;
    } else {
      // Fallback: fetch individually (for standalone usage)
      const poolResponse = await suiClient.getObject({
        id: poolId,
        options: {
          showBcs: true,
          showType: true,
        },
      });

      if (!poolResponse.data?.bcs || poolResponse.data.bcs.dataType !== 'moveObject' || !poolResponse.data.type) {
        return null;
      }

      const marginPool = MarginPool.fromBase64(poolResponse.data.bcs.bcsBytes);
      const tableId = (marginPool as any)?.positions?.positions?.id?.id;

      if (!tableId || typeof tableId !== 'string') {
        return null;
      }

      positionTableId = tableId;
      totalSupply = BigInt(marginPool.state.total_supply);
      supplyShares = BigInt(marginPool.state.supply_shares);
    }

    if (!supplierCapId) {
      return null;
    }
    
    let positionField;
    try {
      positionField = await suiClient.getDynamicFieldObject({
        parentId: positionTableId,
        name: {
          type: '0x2::object::ID',
          value: supplierCapId,
        },
      });
    } catch (err: any) {
      // This is expected if the user has no position in this pool
      if (err?.message?.includes('DynamicFieldNotFound')) {
        return null;
      }
      throw err;
    }

    // If content is missing, fetch it explicitly
    if (positionField.data?.objectId && !positionField.data?.content) {
      positionField = await suiClient.getObject({
        id: positionField.data.objectId,
        options: { showContent: true }
      });
    }

    // Dynamic fields return content, not BCS
    if (!positionField.data?.content) {
      return null;
    }

    // Extract shares from the nested dynamic field structure
    const shares = extractSharesFromDynamicField(positionField.data.content);
    
    if (!shares) {
      return null;
    }
    
    // Convert shares to balance using pool state
    const balanceFormatted = convertSharesToBalance(
      BigInt(shares),
      totalSupply,
      supplyShares,
      decimals,
      asset
    );

    return {
      address: userAddress,
      asset,
      shares: Number(shares),
      balanceFormatted,
      supplierCapId,
    };
  } catch (error) {
    // Ignore errors if the position field doesn't exist (user has cap but no position)
    if (JSON.stringify(error).includes("DynamicFieldNotFound")) {
      return null;
    }
    return null;
  }
}

/**
 * Fetches all user positions across all margin pools for all SupplierCaps.
 * 
 * Optimized to:
 * - Use the static package ID from config instead of fetching it from chain
 * - Batch-fetch all pool objects in a single multiGetObjects call
 * - Pass pre-parsed pool data to avoid redundant individual getObject calls
 * 
 * Before: 1 (packageId) + 1 (caps) + N_caps × N_pools × (1 getObject + 1 getDynamicField) = ~14+ calls
 * After:  1 (caps) + 1 (multiGetObjects) + N_caps × N_pools × 1 (getDynamicField only) = ~6 calls
 */
export async function fetchUserPositions(
  suiClient: SuiClient,
  userAddress: string,
  network: NetworkType = 'mainnet'
): Promise<UserPosition[]> {
  if (!userAddress) {
    return [];
  }

  // Get network-specific pool configurations (static import, no extra RPC)
  const poolConfigs = getMarginPools(network);

  if (poolConfigs.length === 0) {
    return [];
  }

  // Use static package ID from config instead of fetching from chain (saves 1 RPC call)
  const contracts = getContracts(network);
  const packageId = contracts.MARGIN_PACKAGE_ID;

  // Fetch SupplierCaps and all pool data in parallel (saves sequential waiting)
  const poolIds = poolConfigs.map(config => config.poolId);
  const _t0 = performance.now();
  const [allCapIds, poolResponses] = await Promise.all([
    getAllSupplierCaps(suiClient, userAddress, packageId),
    // Single batched RPC call for all pools (replaces N individual getObject calls)
    suiClient.multiGetObjects({
      ids: poolIds,
      options: { showBcs: true, showType: true },
    }),
  ]);
  console.log(`⏱ [userPositions] caps + pools fetch: ${(performance.now() - _t0).toFixed(1)}ms`);

  // Extra safety check to ensure no undefined/null values made it through
  const validCapIds = allCapIds.filter(id => id); 

  if (validCapIds.length === 0) {
    return [];
  }

  // Pre-parse all pool data from the batched response
  const parsedPools = new Map<string, ParsedPoolData>();
  for (let i = 0; i < poolResponses.length; i++) {
    const response = poolResponses[i];
    const poolId = poolIds[i];
    
    if (!response.data?.bcs || response.data.bcs.dataType !== 'moveObject') {
      continue;
    }

    try {
      const marginPool = MarginPool.fromBase64(response.data.bcs.bcsBytes);
      const positionTableId = (marginPool as any)?.positions?.positions?.id?.id;
      
      if (positionTableId && typeof positionTableId === 'string') {
        parsedPools.set(poolId, {
          positionTableId,
          totalSupply: BigInt(marginPool.state.total_supply),
          supplyShares: BigInt(marginPool.state.supply_shares),
        });
      }
    } catch (err) {
      console.warn(`Failed to parse pool ${poolId} for position lookup:`, err);
    }
  }

  // Fetch positions for each SupplierCap across all pools
  // Now each call only needs 1 getDynamicFieldObject (no getObject needed)
  const positionPromises: Promise<UserPosition | null>[] = [];
  
  for (const capId of validCapIds) {
    if (!capId) {
      continue;
    }
    
    // Try this cap against all configured pools
    for (const poolConfig of poolConfigs) {
      const parsedData = parsedPools.get(poolConfig.poolId);
      positionPromises.push(
        fetchUserPositionFromPool(
          suiClient,
          poolConfig.poolId,
          userAddress,
          poolConfig.asset,
          poolConfig.decimals,
          capId,
          parsedData
        )
      );
    }
  }

  const _t1 = performance.now();
  const positions = await Promise.all(positionPromises);
  console.log(`⏱ [userPositions] ${positionPromises.length}× getDynamicField lookups: ${(performance.now() - _t1).toFixed(1)}ms`);
  
  // Return only non-null positions
  return positions.filter((pos): pos is UserPosition => pos !== null);
}
