import { useAppNetwork } from "../context/AppNetworkContext";
import { CONTRACTS } from "../config/contracts";

export function useNetworkContracts() {
  const { network } = useAppNetwork();
  // Safe access with fallback
  return CONTRACTS[network as keyof typeof CONTRACTS] || CONTRACTS.testnet;
}

