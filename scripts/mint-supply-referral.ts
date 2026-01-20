#!/usr/bin/env bun

import { Transaction } from '@mysten/sui/transactions';
import { mintSupplyReferral } from '../src/contracts/deepbook_margin/deepbook_margin/margin_pool.js';
import { getActiveAddress, signAndExecute, ACTIVE_NETWORK } from '../src/utils/account.js';
import { CONTRACTS } from '../src/config/contracts.js';

/**
 * Script to mint a supply referral for the DeepBook margin pool.
 * This creates a SupplyReferral object that can be used to earn referral fees.
 * 
 * Usage:
 *   NETWORK=testnet bun scripts/mint-supply-referral.ts <MARGIN_POOL_ID> <MARGIN_POOL_TYPE>
 * 
 * Example:
 *   NETWORK=testnet bun scripts/mint-supply-referral.ts 0x42c7... 0x...::sui::SUI
 */

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: bun scripts/mint-supply-referral.ts <MARGIN_POOL_ID> <MARGIN_POOL_TYPE>');
    console.error('Example: bun scripts/mint-supply-referral.ts 0x1234... 0x...::sui::SUI');
    process.exit(1);
  }
  
  const marginPoolId: string = args[0];
  const marginPoolType: string = args[1];
  const sender = getActiveAddress();
  
  // Get contract config for the active network
  const config = CONTRACTS[ACTIVE_NETWORK as keyof typeof CONTRACTS];
  if (!config) {
    console.error(`❌ No contract config found for network: ${ACTIVE_NETWORK}`);
    process.exit(1);
  }

  console.log(`🔧 Minting supply referral for margin pool: ${marginPoolId}`);
  console.log(`📍 Network: ${ACTIVE_NETWORK}`);
  console.log(`📝 Registry ID: ${config.MARGIN_REGISTRY_ID}`);
  console.log(`👤 Sender: ${sender}`);
  console.log('');

  try {
    // Create transaction
    const tx = new Transaction();
    
    // Add the mint_supply_referral call
    mintSupplyReferral({
      package: config.MARGIN_PACKAGE_ID, // Explicitly set package ID
      arguments: {
        self: tx.object(marginPoolId),
        registry: tx.object(config.MARGIN_REGISTRY_ID),
      },
      typeArguments: [marginPoolType],
    })(tx);

    // Set gas budget
    tx.setGasBudget(50_000_000);

    console.log('📝 Transaction created, signing and executing...');
    
    // Sign and execute
    const result = await signAndExecute(tx, ACTIVE_NETWORK);
    
    if (result.effects?.status?.status === 'success') {
      console.log('✅ Supply referral minted successfully!');
      console.log(`📋 Transaction digest: ${result.digest}`);
      
      // Find the created SupplyReferral object
      // Note: The ID returned by mint_supply_referral is the ID of the SupplyReferral object
      const createdObjects = result.objectChanges?.filter(
        change => change.type === 'created' && change.objectType?.includes('SupplyReferral')
      );
      
      if (createdObjects && createdObjects.length > 0) {
        const referralObject = createdObjects[0];
        if (referralObject.type === 'created') {
          console.log(`🎯 SupplyReferral object ID: ${referralObject.objectId}`);
          console.log('');
          console.log('💡 You can now use this referral address when calling supply():');
          console.log(`   referral: "${referralObject.objectId}"`);
          console.log('');
          console.log('📝 Update your src/config/contracts.ts with this ID for the corresponding pool.');
        }
      } else {
          console.log("⚠️ Could not find created SupplyReferral object in changes.");
          console.log("Full object changes:", JSON.stringify(result.objectChanges, null, 2));
      }
    } else {
      console.error('❌ Transaction failed:', result.effects?.status);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error minting supply referral:', error);
    process.exit(1);
  }
}

main().catch(console.error);
