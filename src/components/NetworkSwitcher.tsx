import React from "react";
import { useSuiClientContext } from "@mysten/dapp-kit";
import { persistNetwork, type AppNetwork } from "../config/networks";

export function NetworkSwitcher() {
  const { network, selectNetwork } = useSuiClientContext();

  const handleNetworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newNetwork = e.target.value as AppNetwork;
    persistNetwork(newNetwork);
    selectNetwork(newNetwork);
  };

  return (
    <select
      value={network}
      onChange={handleNetworkChange}
      className="w-full bg-[#0d1a1f] text-white px-3 py-2 rounded-lg text-sm border border-white/[0.1] focus:border-[#2dd4bf]/40 focus:outline-none transition-colors cursor-pointer"
    >
      <option value="testnet" className="bg-[#0d1a1f] text-white">Testnet</option>
      <option value="mainnet" className="bg-[#0d1a1f] text-white">Mainnet</option>
    </select>
  );
}
