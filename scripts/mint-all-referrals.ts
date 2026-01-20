#!/usr/bin/env bun

import { Transaction } from '@mysten/sui/transactions';
import { mintSupplyReferral } from '../src/contracts/deepbook_margin/deepbook_margin/margin_pool.js';
import { getActiveAddress, signAndExecute, ACTIVE_NETWORK } from '../src/utils/account.js';
import { CONTRACTS, getMarginPools } from '../src/config/contracts.js';

/**
 * Script to mint supply referrals for ALL margin pools on the active network.
 * This creates SupplyReferral objects that can be used to earn referral fees.
 * 
 * Usage:
 *   NETWORK=mainnet bun scripts/mint-all-referrals.ts
 *   NETWORK=testnet bun scripts/mint-all-referrals.ts
 * 
 * Prerequisites:
 *   1. Have the Sui CLI installed and configured
 *   2. Set your active address with `sui client active-address`
 *   3. Ensure you have sufficient SUI for gas fees
 */

interface ReferralResult {
  asset: string;
  poolId: string;
  referralId: string;
}

async function main() {
  const sender = getActiveAddress();
  
  // Get contract config for the active network
  const config = CONTRACTS[ACTIVE_NETWORK as keyof typeof CONTRACTS];
  if (!config) {
    console.error(`❌ No contract config found for network: ${ACTIVE_NETWORK}`);
    process.exit(1);
  }

  const pools = getMarginPools(ACTIVE_NETWORK as 'mainnet' | 'testnet');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('              MINT SUPPLY REFERRALS FOR ALL POOLS              ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📍 Network: ${ACTIVE_NETWORK}`);
  console.log(`📝 Registry ID: ${config.MARGIN_REGISTRY_ID}`);
  console.log(`👤 Sender: ${sender}`);
  console.log(`📦 Pools to process: ${pools.length}`);
  console.log('');

  const results: ReferralResult[] = [];
  
  for (const pool of pools) {
    console.log(`\n🔧 Processing ${pool.asset} pool...`);
    console.log(`   Pool ID: ${pool.poolId}`);
    
    // Skip if already has a referral
    if (pool.referralId) {
      console.log(`   ⏭️  Skipping - already has referral: ${pool.referralId}`);
      continue;
    }
    
    try {
      // Create transaction
      const tx = new Transaction();
      
      // Add the mint_supply_referral call
      mintSupplyReferral({
        package: config.MARGIN_PACKAGE_ID,
        arguments: {
          self: tx.object(pool.poolId),
          registry: tx.object(config.MARGIN_REGISTRY_ID),
        },
        typeArguments: [pool.poolType],
      })(tx);

      // Set gas budget
      tx.setGasBudget(50_000_000);

      console.log('   📝 Signing and executing transaction...');
      
      // Sign and execute
      const result = await signAndExecute(tx, ACTIVE_NETWORK);
      
      if (result.effects?.status?.status === 'success') {
        // Find the created SupplyReferral object
        const createdObjects = result.objectChanges?.filter(
          change => change.type === 'created' && change.objectType?.includes('SupplyReferral')
        );
        
        if (createdObjects && createdObjects.length > 0) {
          const referralObject = createdObjects[0];
          if (referralObject.type === 'created') {
            console.log(`   ✅ Success! Referral ID: ${referralObject.objectId}`);
            console.log(`   📋 Tx digest: ${result.digest}`);
            
            results.push({
              asset: pool.asset,
              poolId: pool.poolId,
              referralId: referralObject.objectId,
            });
          }
        } else {
          console.log(`   ⚠️  Transaction succeeded but couldn't find SupplyReferral object`);
          console.log(`   📋 Tx digest: ${result.digest}`);
        }
      } else {
        console.error(`   ❌ Transaction failed:`, result.effects?.status);
      }
      
    } catch (error) {
      console.error(`   ❌ Error minting referral for ${pool.asset}:`, error);
    }
    
    // Small delay between transactions
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                           SUMMARY                              ');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (results.length === 0) {
    console.log('No new referrals were created.');
    console.log('(All pools may already have referrals configured)');
  } else {
    console.log(`✅ Successfully created ${results.length} referral(s):\n`);
    
    for (const r of results) {
      console.log(`  ${r.asset}:`);
      console.log(`    Pool ID:     ${r.poolId}`);
      console.log(`    Referral ID: ${r.referralId}`);
      console.log('');
    }
    
    // Generate code snippet for contracts.ts
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   Copy these values to src/config/contracts.ts:');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    for (const r of results) {
      const varName = `${r.asset.toUpperCase()}_MARGIN_POOL_REFERRAL`;
      console.log(`    ${varName}: "${r.referralId}",`);
    }
    console.log('');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
