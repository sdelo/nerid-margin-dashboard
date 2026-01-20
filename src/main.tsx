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

function Root() {
  useEffect(() => {
    setTheme("nerid");
    // Expose a quick switch for manual testing in console: window.setTheme('nerid'|'default')
    (window as any).setTheme = setTheme;
  }, []);
  return <App />;
}

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: getFullnodeUrl("testnet"),
    mvr: {
      overrides: {
        packages: {
          [DEEPBOOK_MARGIN_PACKAGE_NAME]: DEEPBOOK_MARGIN_PACKAGE_IDS.testnet,
        },
      },
    },
  },
  mainnet: {
    url: getFullnodeUrl("mainnet"),
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
            <Root />
          </WalletProvider>
        </AppNetworkProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </StrictMode>
);
