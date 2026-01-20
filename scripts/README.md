# Scripts

This directory contains utility scripts for interacting with the DeepBook margin protocol.

## Mint Supply Referral

Creates a new `SupplyReferral` object that can be used to earn referral fees when users supply assets to margin pools.

### Usage

```bash
# Using npm script (recommended)
NETWORK=testnet npm run mint-referral <MARGIN_POOL_ID>

# Or directly with tsx
NETWORK=testnet tsx scripts/mint-supply-referral.ts <MARGIN_POOL_ID>
```

### Example

```bash
NETWORK=testnet npm run mint-referral 0x442d21fd044b90274934614c3c41416c83582f42eaa8feb4fecea301aa6bdd54
```

### Prerequisites

1. Make sure you have the Sui CLI installed and configured
2. Set your active address with `sui client active-address`
3. Ensure you have sufficient SUI for gas fees
4. The margin pool must exist on the target network

### What it does

1. Creates a transaction calling `mint_supply_referral` on the specified margin pool
2. Signs and executes the transaction using your configured Sui CLI keypair
3. Returns the newly created `SupplyReferral` object ID
4. Provides instructions on how to use the referral address in subsequent `supply()` calls

### Output

The script will output:

- Transaction digest
- The new `SupplyReferral` object ID
- Instructions on how to use the referral in supply transactions
- Information about claiming referral fees later

### Notes

- The `SupplyReferral` object is shared, so you can transfer it to others
- Only the owner of the `SupplyReferral` object can claim referral fees
- Referral fees are calculated based on the supply shares of users who used your referral address
