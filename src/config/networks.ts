export type AppNetwork = "testnet" | "mainnet";

export interface NetworkConfig {
  serverUrl: string;
  explorerUrl: string;
}

const TESTNET_SERVER_URL = "https://deepbook-indexer.testnet.mystenlabs.com";
const MAINNET_SERVER_URL = "https://deepbook-indexer.mainnet.mystenlabs.com";

export const NETWORK_CONFIGS: Record<AppNetwork, NetworkConfig> = {
  testnet: {
    serverUrl: TESTNET_SERVER_URL,
    explorerUrl: "https://testnet.suivision.xyz",
  },
  mainnet: {
    serverUrl: MAINNET_SERVER_URL,
    explorerUrl: "https://suivision.xyz",
  },
};

export const DEFAULT_NETWORK: AppNetwork = "mainnet";

const NETWORK_STORAGE_KEY = "deepdashboard:selectedNetwork";

export function getPersistedNetwork(): AppNetwork {
  try {
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (stored === "testnet" || stored === "mainnet") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_NETWORK;
}

export function persistNetwork(network: AppNetwork): void {
  try {
    localStorage.setItem(NETWORK_STORAGE_KEY, network);
  } catch {
    // localStorage not available
  }
}

