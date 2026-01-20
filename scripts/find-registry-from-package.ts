#!/usr/bin/env bun
/**
 * Script to find MarginRegistry ID from package publish transaction
 * 
 * HOW IT WORKS:
 * 
 * 1. When a Sui package is published, the `init` function (if present) runs automatically
 * 2. In our case, margin_registry.move has an `init` function that creates the MarginRegistry
 * 3. The MarginRegistry is created as a shared object during package publish
 * 4. This script:
 *    - Gets the package object and finds the transaction that published it (previousTransaction)
 *    - Fetches that transaction block to see all objects created during publish
 *    - Searches through created objects to find one matching MarginRegistry type
 *    - Returns the registry ID that matches the current package ID
 * 
 * WHY THIS IS NEEDED:
 * - Each package version has its own MarginRegistry (they're package-specific)
 * - If the package ID changes (new version published), the registry ID changes too
 * - This script automatically finds the correct registry for any package version
 * 
 * Usage: bun scripts/find-registry-from-package.ts <package-id> [network]
 * Example: bun scripts/find-registry-from-package.ts 0xb388009b59b09cd5d219dae79dd3e5d08a5734884363e59a37f3cbe6ef613424 testnet
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const PACKAGE_ID = process.argv[2];
const NETWORK = (process.argv[3] || "testnet") as "testnet" | "mainnet";

if (!PACKAGE_ID) {
  console.error("Usage: bun scripts/find-registry-from-package.ts <package-id> [network]");
  process.exit(1);
}

async function findRegistryFromPackage() {
  const client = new SuiClient({
    url: getFullnodeUrl(NETWORK),
  });

  console.log(`\n🔍 Finding MarginRegistry for package: ${PACKAGE_ID}`);
  console.log(`🌐 Network: ${NETWORK}\n`);

  try {
    // STEP 1: Get the package object
    // showPreviousTransaction: true tells Sui to include the transaction digest
    // that created this package object (i.e., the publish transaction)
    const packageObj = await client.getObject({
      id: PACKAGE_ID,
      options: {
        showPreviousTransaction: true, // This gets us the publish transaction digest
      },
    });

    if (!packageObj.data?.previousTransaction) {
      console.error("❌ Could not find package publish transaction");
      process.exit(1);
    }

    const publishTxDigest = packageObj.data.previousTransaction;
    console.log(`📦 Package publish transaction: ${publishTxDigest}\n`);

    // STEP 2: Fetch the full transaction block that published the package
    // This transaction contains all objects created during package initialization
    // When the package was published, the init() function ran and created MarginRegistry
    const tx = await client.getTransactionBlock({
      digest: publishTxDigest,
      options: {
        showEffects: true,        // Shows transaction effects (created objects, etc.)
        showObjectChanges: true,  // Shows detailed object changes (created, mutated, deleted)
        showEvents: true,         // Shows events emitted (not needed but useful for debugging)
      },
    });

    console.log("🔎 Searching for MarginRegistry in created objects...\n");

    const registryType = `${PACKAGE_ID}::margin_registry::MarginRegistry`;
    let foundRegistry: string | null = null;

    // STEP 3: Search through objectChanges for created objects
    // objectChanges is the most reliable way - it shows exactly what was created
    // and includes the full type information
    if (tx.objectChanges) {
      for (const change of tx.objectChanges) {
        if (change.type === "created" && "objectType" in change) {
          const objectType = change.objectType;
          if (objectType === registryType) {
            foundRegistry = change.objectId;
            console.log(`✅ FOUND REGISTRY!`);
            console.log(`   Registry ID: ${foundRegistry}`);
            console.log(`   Type: ${objectType}`);
            console.log(`   Owner: ${JSON.stringify(change.owner, null, 2)}`);
            console.log(`\n📝 Update your contracts.ts with:`);
            console.log(`   MARGIN_REGISTRY_ID: "${foundRegistry}"`);
            break;
          } else if (objectType?.includes("margin_registry::MarginRegistry")) {
            // Helpful debug info if we find a registry but it's from a different package
            console.log(`⚠️  Found different registry type:`);
            console.log(`   ID: ${change.objectId}`);
            console.log(`   Type: ${objectType}`);
            console.log(`   Expected: ${registryType}\n`);
          }
        }
      }
    }

    // STEP 4: Fallback - check effects.created if objectChanges didn't work
    // This is less ideal because we have to fetch each object to check its type
    // But it's a good backup in case objectChanges format changes
    if (!foundRegistry && tx.effects?.created) {
      for (const created of tx.effects.created) {
        // We'd need to fetch the object to check its type
        try {
          const obj = await client.getObject({
            id: created.reference.objectId,
            options: { showType: true },
          });
          if (obj.data?.type === registryType) {
            foundRegistry = created.reference.objectId;
            console.log(`✅ FOUND REGISTRY in effects!`);
            console.log(`   Registry ID: ${foundRegistry}`);
            console.log(`   Type: ${obj.data.type}`);
            console.log(`\n📝 Update your contracts.ts with:`);
            console.log(`   MARGIN_REGISTRY_ID: "${foundRegistry}"`);
            break;
          }
        } catch (e) {
          // Skip errors (object might have been deleted, etc.)
        }
      }
    }

    if (!foundRegistry) {
      console.log("❌ Could not find MarginRegistry in package publish transaction");
      console.log("\n💡 Try querying recent transactions that created MarginRegistry objects:");
      console.log(`   Look for transactions that create objects of type: ${registryType}`);
      console.log("\n💡 Or check if the registry was created in a separate transaction after package publish");
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

findRegistryFromPackage();
