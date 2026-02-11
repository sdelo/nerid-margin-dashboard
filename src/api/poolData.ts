import { SuiClient, SuiObjectResponse } from '@mysten/sui/client';
import { MarginPool } from '../contracts/deepbook_margin/deepbook_margin/margin_pool';
import { transformMarginPoolData } from '../utils/poolDataTransform';
import type { PoolOverview } from '../features/lending/types';
import { fetchMarginPoolCreated } from '../features/lending/api/events';
import type { NetworkType } from '../config/contracts';

/**
 * Parse a single pool response into PoolOverview format
 */
function parsePoolResponse(
  response: SuiObjectResponse,
  poolId: string,
  network: NetworkType
): PoolOverview | null {
  if (!response.data || !response.data.bcs) {
    console.warn(`No BCS data found for pool ${poolId}`);
    return null;
  }

  const bcsData = response.data.bcs;
  
  // Type guard to ensure we have the right object type
  if (bcsData.dataType !== 'moveObject') {
    console.warn(`Object ${poolId} is not a move object`);
    return null;
  }

  // Parse the BCS data using the generated TypeScript contract
  const marginPool = MarginPool.fromBase64(bcsData.bcsBytes);
  
  // Transform the data using shared utility function
  const assetType = response.data.type || '';
  return transformMarginPoolData(marginPool, poolId, assetType, network);
}

/**
 * Fetches a MarginPool object from the Sui blockchain and transforms it into PoolOverview format
 */
export async function fetchMarginPool(
  suiClient: SuiClient,
  poolId: string,
  network: NetworkType = 'mainnet'
): Promise<PoolOverview | null> {
  try {
    const response = await suiClient.getObject({
      id: poolId,
      options: {
        showBcs: true,
        showType: true,
      },
    });

    const poolOverview = parsePoolResponse(response, poolId, network);
    if (!poolOverview) return null;
    
    // Fetch maintainer cap ID from MarginPoolCreated events
    try {
      const createdEvents = await fetchMarginPoolCreated({
        margin_pool_id: poolId,
        limit: 1,
      });
      if (createdEvents.length > 0 && createdEvents[0].maintainer_cap_id) {
        poolOverview.maintainerCapId = createdEvents[0].maintainer_cap_id;
      }
    } catch (error) {
      console.warn(`Could not fetch maintainer cap ID for pool ${poolId}:`, error);
      // Continue without maintainer cap ID - it's optional
    }
    
    return poolOverview;
  } catch (error) {
    console.error(`Error fetching MarginPool ${poolId}:`, error);
    return null;
  }
}

/**
 * Fetches multiple MarginPool objects in a single batched RPC call.
 * This is more efficient than fetching each pool individually.
 */
export async function fetchMarginPoolsBatched(
  suiClient: SuiClient,
  poolIds: string[],
  network: NetworkType = 'mainnet'
): Promise<(PoolOverview | null)[]> {
  if (poolIds.length === 0) return [];

  try {
    // Use multiGetObjects to fetch all pools in a single RPC call
    const _t0 = performance.now();
    const responses = await suiClient.multiGetObjects({
      ids: poolIds,
      options: {
        showBcs: true,
        showType: true,
      },
    });
    console.log(`⏱ [poolData] multiGetObjects RPC: ${(performance.now() - _t0).toFixed(1)}ms`);

    // Parse all responses
    const pools = responses.map((response, index) => 
      parsePoolResponse(response, poolIds[index], network)
    );

    // Fetch maintainer cap IDs for all pools (single API call to get all events)
    try {
      const _t1 = performance.now();
      const createdEvents = await fetchMarginPoolCreated({ limit: 100 });
      console.log(`⏱ [poolData] fetchMarginPoolCreated (indexer): ${(performance.now() - _t1).toFixed(1)}ms`);
      const capIdMap = new Map(
        createdEvents.map(e => [e.margin_pool_id, e.maintainer_cap_id])
      );
      
      for (const pool of pools) {
        if (pool && capIdMap.has(pool.id)) {
          pool.maintainerCapId = capIdMap.get(pool.id);
        }
      }
    } catch (error) {
      console.warn('Could not fetch maintainer cap IDs:', error);
      // Continue without maintainer cap IDs - they're optional
    }

    return pools;
  } catch (error) {
    console.error('Error fetching MarginPools:', error);
    // Return nulls for all pools on error
    return poolIds.map(() => null);
  }
}
