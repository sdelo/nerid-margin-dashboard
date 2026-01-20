import React from "react";
import { useCurrentAccount, useSuiClientContext, useSuiClient } from "@mysten/dapp-kit";
import { useCoinBalance } from "../hooks/useCoinBalance";

export function DebugInfo() {
  const account = useCurrentAccount();
  const { network } = useSuiClientContext();

  // Test different coin types to see what balances are detected
  const suiBalance = useCoinBalance(account?.address, "0x2::sui::SUI", 9);
  const testnetSuiBalance = useCoinBalance(
    account?.address,
    "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
    9
  );

  if (!account) {
    return (
      <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-sm">
        <h3 className="font-bold mb-2">Debug Info</h3>
        <p>No wallet connected</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div className="space-y-1">
        <p>
          <strong>Network:</strong> {network}
        </p>
        <p>
          <strong>Account:</strong> {account.address.slice(0, 8)}...
          {account.address.slice(-8)}
        </p>
        <p>
          <strong>SUI Balance (0x2::sui::SUI):</strong>{" "}
          {suiBalance?.formatted || "Loading..."}
        </p>
        <p>
          <strong>SUI Balance (testnet):</strong>{" "}
          {testnetSuiBalance?.formatted || "Loading..."}
        </p>
        <p>
          <strong>Raw SUI:</strong> {suiBalance?.raw || "N/A"}
        </p>
        <p>
          <strong>Raw Testnet SUI:</strong> {testnetSuiBalance?.raw || "N/A"}
        </p>
      </div>
    </div>
  );
}
