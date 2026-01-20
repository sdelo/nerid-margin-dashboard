import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { mintSupplyReferral } from '../../src/contracts/deepbook_margin/deepbook_margin/margin_pool.js';
import { getSigner } from '../../src/utils/account.js';

export async function mintReferral(
  client: SuiClient,
  packageId: string,
  registryId: string,
  poolId: string,
  poolType: string,
): Promise<string> {
  console.log(`\n🔧 Minting referral for pool: ${poolId} (${poolType})`);

  const tx = new Transaction();
  
  mintSupplyReferral({
    package: packageId,
    arguments: {
      self: tx.object(poolId),
      registry: tx.object(registryId),
    },
    typeArguments: [poolType],
  })(tx);

  tx.setGasBudget(50_000_000);

  const signer = getSigner();

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
        showEffects: true,
        showObjectChanges: true,
    },
  });
  
  if (result.effects?.status?.status === 'success') {
    const createdObjects = result.objectChanges?.filter(
      change => change.type === 'created' && change.objectType?.includes('SupplyReferral')
    );
    
    if (createdObjects && createdObjects.length > 0 && 'objectId' in createdObjects[0]) {
      const id = createdObjects[0].objectId;
      console.log(`✅ Created Referral ID: ${id}`);
      return id;
    }
  }
  
  throw new Error(`Failed to mint referral: ${JSON.stringify(result.effects?.status)}`);
}
