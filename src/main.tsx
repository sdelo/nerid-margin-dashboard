import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@mysten/dapp-kit/dist/index.css";
import App from "./App";
import { setTheme } from "./theme";
import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider,
} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DEEPBOOK_MARGIN_PACKAGE_IDS,
  DEEPBOOK_MARGIN_PACKAGE_NAME,
} from "./config/contracts";
import { getPersistedNetwork } from "./config/networks";
import { AppNetworkProvider } from "./context/AppNetworkContext";
import { StickyHeaderProvider } from "./context/StickyHeaderContext";

function Root() {
  useEffect(() => {
    setTheme("nerid");
    // Expose a quick switch for manual testing in console: window.setTheme('nerid'|'default')
    (window as any).setTheme = setTheme;
  }, []);
  return <App />;
}

// Get RPC URLs - prefer custom RPC endpoints from env vars to avoid rate limits
// Public fullnodes have aggressive rate limits and may return 503 errors
// 
// Options:
// 1. VITE_SUI_MAINNET_RPC_URL - Direct RPC URL (use with Shinami domain restrictions)
// 2. VITE_USE_RPC_PROXY=true - Use /api/sui-rpc proxy (API key stays server-side)
const getTestnetRpcUrl = () => {
  const customUrl = import.meta.env.VITE_SUI_TESTNET_RPC_URL;
  return customUrl || getFullnodeUrl("testnet");
};

const getMainnetRpcUrl = () => {
  // If using the proxy, point to the Vercel API route
  if (import.meta.env.VITE_USE_RPC_PROXY === "true") {
    // In production, this resolves to /api/sui-rpc
    // In development, you'd need to run vercel dev or use the direct URL
    return "/api/sui-rpc";
  }
  
  const customUrl = import.meta.env.VITE_SUI_MAINNET_RPC_URL;
  return customUrl || getFullnodeUrl("mainnet");
};

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: getTestnetRpcUrl(),
    mvr: {
      overrides: {
        packages: {
          [DEEPBOOK_MARGIN_PACKAGE_NAME]: DEEPBOOK_MARGIN_PACKAGE_IDS.testnet,
        },
      },
    },
  },
  mainnet: {
    url: getMainnetRpcUrl(),
    mvr: {
      overrides: {
        packages: {
          [DEEPBOOK_MARGIN_PACKAGE_NAME]: DEEPBOOK_MARGIN_PACKAGE_IDS.mainnet,
        },
      },
    },
  },
});

const queryClient = new QueryClient();

// Read persisted network before first render
const initialNetwork = getPersistedNetwork();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networkConfig}
        defaultNetwork={initialNetwork}
      >
        <AppNetworkProvider>
          <WalletProvider
            autoConnect
            storageKey="deepdashboard:lastConnectedAccount"
          >
            <StickyHeaderProvider>
              <Root />
            </StickyHeaderProvider>
          </WalletProvider>
        </AppNetworkProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </StrictMode>
);
