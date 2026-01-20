import React from "react";
import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { Link, useLocation } from "react-router-dom";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { NetworkSwitcher } from "../../../components/NetworkSwitcher";
import { brand } from "../../../config/brand";

export default function NavBar() {
  const currentAccount = useCurrentAccount();
  const [open, setOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { network } = useSuiClientContext();
  const location = useLocation();
  const settingsRef = React.useRef<HTMLDivElement>(null);

  function getShortAddress(address: string): string {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // Close settings dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="w-full">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-3 flex items-center justify-between text-white">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link 
            to="/" 
            className="flex items-center gap-2.5 font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-[#2dd4bf]/10 p-1.5 border border-[#2dd4bf]/15">
              <img src={brand.logo.src} alt={brand.logo.alt} className="w-full h-full" />
            </div>
            <span className="text-lg tracking-wide">{brand.name}</span>
          </Link>
          
          {location.pathname !== "/" && (
            <div className="hidden md:flex items-center gap-1">
              <Link 
                to="/pools" 
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/pools"
                    ? "text-[#2dd4bf] bg-[#2dd4bf]/10"
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                Pools
              </Link>
              <Link 
                to="/liquidations" 
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/liquidations"
                    ? "text-[#2dd4bf] bg-[#2dd4bf]/10"
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                Liquidations
              </Link>
            </div>
          )}
        </div>

        {/* Right: Network Badge + Settings + Wallet */}
        <div className="flex items-center gap-3">
          {/* Subtle Network Badge */}
          <div className="hidden sm:flex items-center">
            <span className={`px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider ${
              network === "mainnet" 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}>
              {network}
            </span>
          </div>

          {/* Settings Dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/50 hover:text-white transition-all"
              aria-label="Settings"
            >
              <Cog6ToothIcon className="w-4 h-4" />
            </button>
            
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#0d1a1f] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Settings</h3>
                </div>
                <div className="p-4">
                  <div>
                    <label className="text-xs text-white/50 block mb-2">Network</label>
                    <NetworkSwitcher />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {currentAccount ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] font-mono text-xs text-white/70">
                {getShortAddress(currentAccount.address)}
              </span>
              <button
                onClick={() => disconnectWallet()}
                className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/50 hover:text-white text-xs font-medium transition-all"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <ConnectModal
              open={open}
              onOpenChange={setOpen}
              trigger={
                <button
                  onClick={() => setOpen(true)}
                  className="btn-primary py-2.5 px-5 text-sm"
                >
                  Connect Wallet
                </button>
              }
            />
          )}
        </div>
      </div>
    </nav>
  );
}
