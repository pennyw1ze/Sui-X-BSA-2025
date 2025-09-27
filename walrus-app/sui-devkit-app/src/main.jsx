import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider,
} from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";
import App from "./App.tsx";

const queryClient = new QueryClient();

// Pick your RPCs (testnet by default)
const { networkConfig } = createNetworkConfig({
  testnet: { url: "https://fullnode.testnet.sui.io:443" },
  mainnet: { url: "https://fullnode.mainnet.sui.io:443" },
});

const rootEl = document.getElementById("root"); 
if (!rootEl) throw new Error("Failed to find the root element");  

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        {/* WalletProvider injects the Wallet Standard. Slush will show up automatically if installed */}
        <WalletProvider autoConnect>
          <App />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
  </React.StrictMode>
);

