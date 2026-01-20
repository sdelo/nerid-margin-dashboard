#!/usr/bin/env bun
/**
 * Consolidated script to update contract configuration based on a new package ID.
 * 
 * Usage: bun scripts/update-contracts.ts <PACKAGE_ID> [NETWORK]
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { findRegistryFromPackage } from "./utils/find-registry.js";
import { findPoolsFromPackage } from "./utils/find-pools.js";
import { mintReferral } from "./utils/mint-referral.js";

const PACKAGE_ID = process.argv[2];
const NETWORK = (process.argv[3] || "testnet") as "testnet" | "mainnet";

if (!PACKAGE_ID) {
  console.error("Usage: bun scripts/update-contracts.ts <PACKAGE_ID> [NETWORK]");
  process.exit(1);
}

async function main() {
  console.log(`🚀 Starting Contract Update Process`);
  console.log(`📦 Package: ${PACKAGE_ID}`);
  console.log(`🌐 Network: ${NETWORK}`);

  const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });

  try {
    // Step 1: Find Registry
    const registryId = await findRegistryFromPackage(client, PACKAGE_ID);
    console.log(`\n✅ Found Registry ID: ${registryId}`);

    // Step 2: Find Pools
    const pools = await findPoolsFromPackage(client, PACKAGE_ID);
    
    if (!pools.suiPool && !pools.dbusdcPool) {
      console.error("❌ No pools found!");
      process.exit(1);
    }

    console.log(`\n✅ Found Pools:`);
    if (pools.suiPool) console.log(`   SUI: ${pools.suiPool.id}`);
    if (pools.dbusdcPool) console.log(`   DBUSDC: ${pools.dbusdcPool.id}`);

    // Step 3: Mint Referrals
    let suiReferral = "";
    let dbusdcReferral = "";

    if (pools.suiPool) {
      // extract inner type from MarginPool<T>
      const innerType = pools.suiPool.type.match(/<(.+)>/)?.[1];
      if (innerType) {
        suiReferral = await mintReferral(client, PACKAGE_ID, registryId, pools.suiPool.id, innerType);
      }
    }

    if (pools.dbusdcPool) {
      const innerType = pools.dbusdcPool.type.match(/<(.+)>/)?.[1];
      if (innerType) {
        dbusdcReferral = await mintReferral(client, PACKAGE_ID, registryId, pools.dbusdcPool.id, innerType);
      }
    }

    // Output Configuration
    console.log(`\n✨ Update Complete! Here is your new configuration block:\n`);
    
    const configBlock = `
  ${NETWORK}: {
    MARGIN_PACKAGE_ID: "${PACKAGE_ID}",

    // Registry Object
    MARGIN_REGISTRY_ID: "${registryId}",
    
    // Coins (Verify these!)
    DEEP_ID: "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8",
    SUI_ID: "0x0000000000000000000000000000000000000000000000000000000000000002",
    DBUSDC_ID: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7",
    
    // Margin Pools
    ${pools.suiPool ? `SUI_MARGIN_POOL_ID: "${pools.suiPool.id}",` : '// SUI Pool Not Found'}
    ${pools.suiPool ? `SUI_MARGIN_POOL_TYPE: "${pools.suiPool.type.match(/<(.+)>/)?.[1]}",` : ''}
    ${pools.dbusdcPool ? `DBUSDC_MARGIN_POOL_ID: "${pools.dbusdcPool.id}",` : '// DBUSDC Pool Not Found'}
    ${pools.dbusdcPool ? `DBUSDC_MARGIN_POOL_TYPE: "${pools.dbusdcPool.type.match(/<(.+)>/)?.[1]}",` : ''}

    // Generated Referrals
    ${suiReferral ? `SUI_MARGIN_POOL_REFERRAL: "${suiReferral}",` : '// SUI Referral Failed'}
    ${dbusdcReferral ? `DBUSDC_MARGIN_POOL_REFERRAL: "${dbusdcReferral}",` : '// DBUSDC Referral Failed'}
  },`;

    console.log(configBlock);
    console.log(`\n📋 Copy this block into src/config/contracts.ts`);

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
