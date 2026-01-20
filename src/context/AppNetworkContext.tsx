import React, { createContext, useContext, useEffect } from "react";
import { useSuiClientContext } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import {
  NETWORK_CONFIGS,
  AppNetwork,
  DEFAULT_NETWORK,
} from "../config/networks";
import { apiClient } from "../lib/api/client";
import { useIndexerStatus, type IndexerStatus } from "../hooks/useIndexerStatus";

interface AppNetworkContextType {
  network: AppNetwork;
  serverUrl: string;
  explorerUrl: string;
  /** Indexer health status - use to warn users when data may be stale */
  indexerStatus: IndexerStatus;
}

const AppNetworkContext = createContext<AppNetworkContextType | null>(null);

export function AppNetworkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { network: suiNetwork } = useSuiClientContext();
  const queryClient = useQueryClient();

  // Safe cast or fallback
  const currentNetwork = (suiNetwork as AppNetwork) || DEFAULT_NETWORK;

  // Configuration is driven by src/config/networks.ts
  const config =
    NETWORK_CONFIGS[currentNetwork] || NETWORK_CONFIGS[DEFAULT_NETWORK];
  const { serverUrl, explorerUrl } = config;

  // Update API client when serverUrl changes
  useEffect(() => {
    apiClient.setBaseUrl(serverUrl);
  }, [serverUrl]);

  // Reset all queries when serverUrl changes (handles network changes)
  useEffect(() => {
    queryClient.resetQueries();
  }, [serverUrl, queryClient]);

  // Fetch indexer health status
  const indexerStatus = useIndexerStatus(serverUrl);

  return (
    <AppNetworkContext.Provider
      value={{
        network: currentNetwork,
        serverUrl,
        explorerUrl,
        indexerStatus,
      }}
    >
      {children}
    </AppNetworkContext.Provider>
  );
}

export function useAppNetwork() {
  const context = useContext(AppNetworkContext);
  if (!context) {
    throw new Error("useAppNetwork must be used within AppNetworkProvider");
  }
  return context;
}
