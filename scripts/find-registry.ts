#!/usr/bin/env bun
/**
 * Script to find the correct MarginRegistry ID for a given package ID
 * 
 * Usage: bun scripts/find-registry.ts <package-id> [network]
 * Example: bun scripts/find-registry.ts 0xb388009b59b09cd5d219dae79dd3e5d08a5734884363e59a37f3cbe6ef613424 testnet
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const PACKAGE_ID = process.argv[2];
const NETWORK = (process.argv[3] || "testnet") as "testnet" | "mainnet";

if (!PACKAGE_ID) {
  console.error("Usage: bun scripts/find-registry.ts <package-id> [network]");
  process.exit(1);
}

const REGISTRY_TYPE = `${PACKAGE_ID}::margin_registry::MarginRegistry`;

async function findRegistry() {
  const client = new SuiClient({
    url: getFullnodeUrl(NETWORK),
  });

  console.log(`\n🔍 Searching for MarginRegistry with type: ${REGISTRY_TYPE}`);
  console.log(`🌐 Network: ${NETWORK}\n`);

  try {
    // Query for all objects of type MarginRegistry
    // Note: getOwnedObjects doesn't work for shared objects, so we need to use a different approach
    // We'll query the package to see if we can find the registry
    
    // First, let's try to get the package info
    const packageInfo = await client.getObject({
      id: PACKAGE_ID,
      options: {
        showType: true,
        showContent: true,
      },
    });

    console.log("📦 Package Info:");
    console.log(`   Type: ${packageInfo.data?.type}`);
    console.log(`   Owner: ${JSON.stringify(packageInfo.data?.owner, null, 2)}\n`);

    // Since MarginRegistry is a shared object, we can't query it directly via getOwnedObjects
    // Instead, we need to look for events or transactions that reference it
    // Or query known registry IDs and check their types
    
    console.log("💡 Alternative approach: Query known registry IDs and verify their type\n");
    
    // List of known registry IDs to check
    const knownRegistryIds = [
      "0x851e63bd0a3e25a12f02df82f0a1683064ee7ed0b1297dcd18707aa22b382ad3", // Current testnet
      // Add more known IDs here
    ];

    for (const registryId of knownRegistryIds) {
      try {
        const registry = await client.getObject({
          id: registryId,
          options: {
            showType: true,
            showContent: true,
          },
        });

        if (registry.data?.type === REGISTRY_TYPE) {
          console.log(`✅ FOUND MATCHING REGISTRY!`);
          console.log(`   Registry ID: ${registryId}`);
          console.log(`   Type: ${registry.data.type}`);
          console.log(`   Owner: ${JSON.stringify(registry.data.owner, null, 2)}`);
          console.log(`\n📝 Update your contracts.ts with:`);
          console.log(`   MARGIN_REGISTRY_ID: "${registryId}"`);
          return;
        } else {
          console.log(`❌ Registry ${registryId}:`);
          console.log(`   Type: ${registry.data?.type}`);
          console.log(`   Expected: ${REGISTRY_TYPE}`);
          console.log(`   Match: ${registry.data?.type === REGISTRY_TYPE ? "✅" : "❌"}\n`);
        }
      } catch (error: any) {
        console.log(`⚠️  Error querying registry ${registryId}: ${error.message}\n`);
      }
    }

    console.log("\n💡 To find the registry via GraphQL, use this query:");
    console.log(`
query FindMarginRegistry {
  object(
    address: "YOUR_REGISTRY_ID_HERE"
  ) {
    address
    version
    digest
    owner {
      ... on Shared {
        initialSharedVersion
      }
    }
    contents {
      json
      type {
        repr
      }
    }
  }
}
    `);

    console.log("\n💡 Or query events that reference the registry:");
    console.log(`
query FindRegistryFromEvents {
  events(
    filter: {
      package: "${PACKAGE_ID}"
    }
    first: 100
  ) {
    nodes {
      sendingModule
      eventType
      parsedJson
      transaction {
        digest
      }
    }
  }
}
    `);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

findRegistry();










