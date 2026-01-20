import { SuiClient } from '@mysten/sui/client';
import { MarginPool } from '../contracts/deepbook_margin/deepbook_margin/margin_pool';
import { transformMarginPoolData } from '../utils/poolDataTransform';
import type { PoolOverview } from '../features/lending/types';
import { fetchMarginPoolCreated } from '../features/lending/api/events';
import type { NetworkType } from '../config/contracts';

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
    const poolOverview = transformMarginPoolData(marginPool, poolId, assetType, network);
    
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
