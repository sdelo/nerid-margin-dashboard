# GraphQL Queries to Find MarginRegistry

## Option 1: Query by Object ID (if you have a candidate ID)

```graphql
query FindMarginRegistry($registryId: ID!) {
  object(address: $registryId) {
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
```

**Variables:**
```json
{
  "registryId": "0x851e63bd0a3e25a12f02df82f0a1683064ee7ed0b1297dcd18707aa22b382ad3"
}
```

## Option 2: Query Events from Package to Find Registry References

Since MarginRegistry is created during package initialization, we can look for events or transactions from the package:

```graphql
query FindRegistryFromPackageEvents($packageId: ID!) {
  events(
    filter: {
      package: $packageId
    }
    first: 100
    order: ASC
  ) {
    nodes {
      sendingModule
      eventType
      parsedJson
      transaction {
        digest
        effects {
          created {
            address
            owner {
              ... on Shared {
                initialSharedVersion
              }
            }
            type {
              repr
            }
          }
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "packageId": "0xb388009b59b09cd5d219dae79dd3e5d08a5734884363e59a37f3cbe6ef613424"
}
```

## Option 3: Query Transactions from Package Creation

Find the transaction that published the package and look for created shared objects:

```graphql
query FindPackagePublishTransaction($packageId: ID!) {
  object(address: $packageId) {
    transaction {
      digest
      effects {
        created {
          address
          owner {
            ... on Shared {
              initialSharedVersion
            }
          }
          type {
            repr
          }
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "packageId": "0xb388009b59b09cd5d219dae79dd3e5d08a5734884363e59a37f3cbe6ef613424"
}
```

## Option 4: Query by Type (if GraphQL supports it)

Some GraphQL endpoints support querying by type:

```graphql
query FindRegistryByType($type: String!) {
  objects(
    filter: {
      type: $type
    }
    first: 10
  ) {
    nodes {
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
}
```

**Variables:**
```json
{
  "type": "0xb388009b59b09cd5d219dae79dd3e5d08a5734884363e59a37f3cbe6ef613424::margin_registry::MarginRegistry"
}
```

## Testnet GraphQL Endpoint

The Sui testnet GraphQL endpoint is typically:
- **URL**: `https://api.testnet.sui.io/graphql`
- **Method**: POST
- **Headers**: 
  ```json
  {
    "Content-Type": "application/json"
  }
  ```

## Example cURL Request

```bash
curl -X POST https://api.testnet.sui.io/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query FindMarginRegistry($registryId: ID!) { object(address: $registryId) { address type { repr } owner { ... on Shared { initialSharedVersion } } } }",
    "variables": {
      "registryId": "0x851e63bd0a3e25a12f02df82f0a1683064ee7ed0b1297dcd18707aa22b382ad3"
    }
  }'
```

## What to Look For

When you find the registry object, verify:
1. **Type matches**: Should be `{PACKAGE_ID}::margin_registry::MarginRegistry`
2. **Owner is Shared**: The owner should be `Shared` (not `AddressOwner` or `ObjectOwner`)
3. **Package ID matches**: The package ID in the type should match your current package

## Quick Check Script

Run the TypeScript script to check known registry IDs:

```bash
bun scripts/find-registry.ts 0xb388009b59b09cd5d219dae79dd3e5d08a5734884363e59a37f3cbe6ef613424 testnet
```










