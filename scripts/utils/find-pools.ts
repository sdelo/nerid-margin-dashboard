import { SuiClient } from "@mysten/sui/client";

export interface FoundPools {
  suiPool?: { id: string; type: string };
  dbusdcPool?: { id: string; type: string };
}

export async function findPoolsFromPackage(client: SuiClient, packageId: string): Promise<FoundPools> {
  console.log(`\n🔍 Finding Margin Pools for package: ${packageId}`);

  // Query for MarginPoolCreated events
  const events = await client.queryEvents({
    query: {
      MoveEventType: `${packageId}::margin_pool::MarginPoolCreated`
    },
    limit: 50,
  });

  const result: FoundPools = {};

  for (const event of events.data) {
    const data = event.parsedJson as any;
    const assetType = data.asset_type?.name;
    const poolId = data.margin_pool_id;

    if (assetType?.includes('sui::SUI')) {
      result.suiPool = { id: poolId, type: `${packageId}::margin_pool::MarginPool<${assetType}>` };
    } else if (assetType?.includes('DBUSDC')) {
      result.dbusdcPool = { id: poolId, type: `${packageId}::margin_pool::MarginPool<${assetType}>` };
    }
  }

  return result;
}










