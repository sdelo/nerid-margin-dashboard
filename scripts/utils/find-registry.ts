import { SuiClient } from "@mysten/sui/client";

export async function findRegistryFromPackage(client: SuiClient, packageId: string) {
  console.log(`\n🔍 Finding MarginRegistry for package: ${packageId}`);

  // Get the package object to find its publish transaction
  const packageObj = await client.getObject({
    id: packageId,
    options: {
      showPreviousTransaction: true,
    },
  });

  if (!packageObj.data?.previousTransaction) {
    throw new Error("❌ Could not find package publish transaction");
  }

  const publishTxDigest = packageObj.data.previousTransaction;
  // console.log(`📦 Package publish transaction: ${publishTxDigest}`);

  // Get the transaction details
  const tx = await client.getTransactionBlock({
    digest: publishTxDigest,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  const registryType = `${packageId}::margin_registry::MarginRegistry`;
  
  // Search object changes
  if (tx.objectChanges) {
    for (const change of tx.objectChanges) {
      if (change.type === "created" && "objectType" in change) {
        if (change.objectType === registryType) {
          return change.objectId;
        }
      }
    }
  }

  // Search effects (fallback)
  if (tx.effects?.created) {
    for (const created of tx.effects.created) {
      try {
        const obj = await client.getObject({
          id: created.reference.objectId,
          options: { showType: true },
        });
        if (obj.data?.type === registryType) {
          return created.reference.objectId;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  throw new Error("❌ Could not find MarginRegistry in package publish transaction");
}










