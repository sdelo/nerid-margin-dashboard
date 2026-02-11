export const CONTRACTS = {
  testnet: {
    // Published package - from pool object type
    MARGIN_PACKAGE_ID: "0xb8620c24c9ea1a4a41e79613d2b3d1d93648d1bb6f6b789a7c8f261c94110e4b",

    // Registry Object (shared object from package init)
    MARGIN_REGISTRY_ID: "0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75",
    
    // Coins
    DEEP_ID: "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8",
    SUI_ID: "0x0000000000000000000000000000000000000000000000000000000000000002",
    DBUSDC_ID: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7",
    
    // Margin Pools - Updated from indexer /margin_pool_created endpoint
    SUI_MARGIN_POOL_ID: "0xcdbbe6a72e639b647296788e2e4b1cac5cea4246028ba388ba1332ff9a382eea",
    SUI_MARGIN_POOL_TYPE: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
    DBUSDC_MARGIN_POOL_ID: "0xf08568da93834e1ee04f09902ac7b1e78d3fdf113ab4d2106c7265e95318b14d",
    DBUSDC_MARGIN_POOL_TYPE: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC",

    // Referrals
    SUI_MARGIN_POOL_REFERRAL: "0x8b8b5d1cd1b703a5788f1b951e8f4c6f8bcbad37d58b8280bd58b29c692683c0",
    DBUSDC_MARGIN_POOL_REFERRAL: "0x8f140aca65c9233603edec60708b9c8b6ac68aef5d436732b907d26ca41bfce6",

    // DeepBook v3 Pool (SUI/DBUSDC) - for liquidations
    DEEPBOOK_SUI_DBUSDC_POOL_ID: "", // TODO: Add testnet DeepBook pool ID
    
    // Pyth Oracle PriceInfoObject IDs
    SUI_ORACLE_ID: "", // TODO: Add testnet oracle ID
    DBUSDC_ORACLE_ID: "", // TODO: Add testnet oracle ID
  },
  mainnet: {
    MARGIN_PACKAGE_ID: "0x97d9473771b01f77b0940c589484184b49f6444627ec121314fae6a6d36fb86b",

    // Registry Object
    MARGIN_REGISTRY_ID: "0x0e40998b359a9ccbab22a98ed21bd4346abf19158bc7980c8291908086b3a742",
    
    // Coins
    SUI_ID: "0x0000000000000000000000000000000000000000000000000000000000000002",
    USDC_ID: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7",
    DEEP_ID: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270",
    WAL_ID: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59",
    
    // Margin Pools
    SUI_MARGIN_POOL_ID: "0x53041c6f86c4782aabbfc1d4fe234a6d37160310c7ee740c915f0a01b7127344",
    SUI_MARGIN_POOL_TYPE: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
    USDC_MARGIN_POOL_ID: "0xba473d9ae278f10af75c50a8fa341e9c6a1c087dc91a3f23e8048baf67d0754f",
    USDC_MARGIN_POOL_TYPE: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    DEEP_MARGIN_POOL_ID: "0x1d723c5cd113296868b55208f2ab5a905184950dd59c48eb7345607d6b5e6af7",
    DEEP_MARGIN_POOL_TYPE: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    WAL_MARGIN_POOL_ID: "0x38decd3dbb62bd4723144349bf57bc403b393aee86a51596846a824a1e0c2c01",
    WAL_MARGIN_POOL_TYPE: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",

    // Referrals
    SUI_MARGIN_POOL_REFERRAL: "0xf5cf4cbaecefb03d69f507252449c3b2e85297676deb9193e37e10d776723803",
    USDC_MARGIN_POOL_REFERRAL: "0xf71910d2f1b6aaa25588111d8339e55581d28cfaa913a4ac95913428bd6481bb",
    DEEP_MARGIN_POOL_REFERRAL: "0xbeb73a813a67d70a2ede938b23809b0d2de74b653ab6f0d94d89ac4b45e21990",
    WAL_MARGIN_POOL_REFERRAL: "0xd61c2d145cadcd595d6176b7075cf2540a2ff0d01fd41e80f7c97ece2b8937be",

    // DeepBook v3 Pools - for liquidations
    DEEPBOOK_SUI_USDC_POOL_ID: "0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407",
    
    // Pyth Oracle PriceInfoObject IDs (mainnet)
    SUI_ORACLE_ID: "0x801dbc2f0053d34734814b2d6df491ce7807a725fe9a01ad74a07e9c51396c37",
    USDC_ORACLE_ID: "0x5dec622733a204ca27f5a90d8c2fad453cc6665186fd5dff13a83d0b6c9027ab",
    
    // Pyth State IDs (for updating prices)
    PYTH_STATE_ID: "0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8",
    WORMHOLE_STATE_ID: "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
  },
} as const;

// Pyth Price Feed IDs (same for mainnet and testnet)
// From https://docs.pyth.network/price-feeds/price-feeds
export const PYTH_PRICE_FEEDS = {
  SUI_USD: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  USDC_USD: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
} as const;

// Legacy exports for backward compatibility
export const DEEPBOOK_MARGIN_PACKAGE_IDS = {
  testnet: CONTRACTS.testnet.MARGIN_PACKAGE_ID,
  mainnet: CONTRACTS.mainnet.MARGIN_PACKAGE_ID,
} as const;

export const DEEPBOOK_MARGIN_PACKAGE_NAME = "@local-pkg/deepbook-margin" as const;

// Helper to get contracts for a specific network
export type NetworkType = "testnet" | "mainnet";
export function getContracts(network: NetworkType) {
  return CONTRACTS[network];
}

// Pool configuration for dynamic iteration
export interface PoolConfig {
  asset: string;
  poolId: string;
  poolType: string;
  coinId: string;
  decimals: number;
  referralId?: string;
  /** DeepBook trading pair name for market stats (e.g., "SUI_USDC") */
  tradingPair?: string;
}

// Get all margin pools for a network
export function getMarginPools(network: NetworkType): PoolConfig[] {
  if (network === 'testnet') {
    const c = CONTRACTS.testnet;
    return [
      {
        asset: 'SUI',
        poolId: c.SUI_MARGIN_POOL_ID,
        poolType: c.SUI_MARGIN_POOL_TYPE,
        coinId: c.SUI_ID,
        decimals: 9,
        referralId: c.SUI_MARGIN_POOL_REFERRAL,
        tradingPair: 'SUI_USDC',
      },
      {
        asset: 'DBUSDC',
        poolId: c.DBUSDC_MARGIN_POOL_ID,
        poolType: c.DBUSDC_MARGIN_POOL_TYPE,
        coinId: c.DBUSDC_ID,
        decimals: 6,
        referralId: c.DBUSDC_MARGIN_POOL_REFERRAL,
        tradingPair: 'SUI_USDC', // Quote currency - use same pair
      },
    ];
  }
  
  // mainnet
  const c = CONTRACTS.mainnet;
  return [
    {
      asset: 'SUI',
      poolId: c.SUI_MARGIN_POOL_ID,
      poolType: c.SUI_MARGIN_POOL_TYPE,
      coinId: c.SUI_ID,
      decimals: 9,
      referralId: c.SUI_MARGIN_POOL_REFERRAL,
      tradingPair: 'SUI_USDC',
    },
    {
      asset: 'USDC',
      poolId: c.USDC_MARGIN_POOL_ID,
      poolType: c.USDC_MARGIN_POOL_TYPE,
      coinId: c.USDC_ID,
      decimals: 6,
      referralId: c.USDC_MARGIN_POOL_REFERRAL,
      tradingPair: 'SUI_USDC', // Quote currency - use same pair
    },
    {
      asset: 'DEEP',
      poolId: c.DEEP_MARGIN_POOL_ID,
      poolType: c.DEEP_MARGIN_POOL_TYPE,
      coinId: c.DEEP_ID,
      decimals: 6,
      referralId: c.DEEP_MARGIN_POOL_REFERRAL,
      tradingPair: 'DEEP_USDC',
    },
    {
      asset: 'WAL',
      poolId: c.WAL_MARGIN_POOL_ID,
      poolType: c.WAL_MARGIN_POOL_TYPE,
      coinId: c.WAL_ID,
      decimals: 9,
      referralId: c.WAL_MARGIN_POOL_REFERRAL,
      tradingPair: 'WAL_USDC',
    },
  ];
}
