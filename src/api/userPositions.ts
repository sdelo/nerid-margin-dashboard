import { SuiClient } from '@mysten/sui/client';
import { MarginPool } from '../contracts/deepbook_margin/deepbook_margin/margin_pool';
import { getContracts, type NetworkType } from '../config/contracts';
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
 * Helper to get package ID from pool type
 */
function getPackageId(poolType: string): string {
  return poolType.split("::")[0];
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

/**
 * Fetches a user's position from a specific margin pool for a given SupplierCap
 */
export async function fetchUserPositionFromPool(
  suiClient: SuiClient,
  poolId: string,
  userAddress: string,
  asset: PoolAssetSymbol,
  decimals: number,
  supplierCapId: string
): Promise<UserPosition | null> {
  try {
    // Fetch the margin pool to access the position manager
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

    // Parse the MarginPool to get the position manager
    const marginPool = MarginPool.fromBase64(poolResponse.data.bcs.bcsBytes);
    
    // Safe access to table ID
    // Structure: marginPool -> positions (PositionManager) -> positions (Table) -> id (UID) -> id (Address)
    const positionTableId = (marginPool as any)?.positions?.positions?.id?.id;

    if (!positionTableId || typeof positionTableId !== 'string') {
      return null;
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
      BigInt(marginPool.state.total_supply),
      BigInt(marginPool.state.supply_shares),
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
 * Fetches all user positions across all margin pools for all SupplierCaps
 */
export async function fetchUserPositions(
  suiClient: SuiClient,
  userAddress: string,
  network: NetworkType = 'mainnet'
): Promise<UserPosition[]> {
  if (!userAddress) {
    return [];
  }

  // Get network-specific pool configurations
  const { getMarginPools } = await import('../config/contracts');
  const poolConfigs = getMarginPools(network);

  if (poolConfigs.length === 0) {
    return [];
  }

  // Get package ID from the first pool (all pools use the same package)
  const firstPoolResponse = await suiClient.getObject({
    id: poolConfigs[0].poolId,
    options: { showType: true },
  });

  const packageId = firstPoolResponse.data?.type 
    ? getPackageId(firstPoolResponse.data.type)
    : null;

  if (!packageId) {
    return [];
  }

  // Fetch all SupplierCaps for this package (one cap can be used across all pools)
  const allCapIds = await getAllSupplierCaps(suiClient, userAddress, packageId);

  // Extra safety check to ensure no undefined/null values made it through
  const validCapIds = allCapIds.filter(id => id); 

  if (validCapIds.length === 0) {
    return [];
  }

  // Fetch positions for each SupplierCap across all pools
  const positionPromises: Promise<UserPosition | null>[] = [];
  
  for (const capId of validCapIds) {
    if (!capId) {
      continue;
    }
    
    // Try this cap against all configured pools
    for (const poolConfig of poolConfigs) {
      positionPromises.push(
        fetchUserPositionFromPool(
          suiClient,
          poolConfig.poolId,
          userAddress,
          poolConfig.asset,
          poolConfig.decimals,
          capId
        )
      );
    }
  }

  const positions = await Promise.all(positionPromises);
  
  // Return only non-null positions
  return positions.filter((pos): pos is UserPosition => pos !== null);
}
