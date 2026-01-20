import React from "react";
import { Link } from "react-router-dom";
import { useSuiClientContext } from "@mysten/dapp-kit";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { brand } from "../config/brand";
import { NetworkSwitcher } from "./NetworkSwitcher";

export function LandingNavBar() {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const { network } = useSuiClientContext();
  const settingsRef = React.useRef<HTMLDivElement>(null);

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
    <nav className="w-full fixed top-0 z-50 backdrop-blur-md bg-[#0c1a24]/80 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left - Brand */}
        <Link
          to="/"
          className="flex items-center gap-2.5 font-bold text-white text-lg hover:opacity-80 transition-opacity"
        >
          <img
            src={brand.logo.src}
            alt={brand.logo.alt}
            className={brand.logo.sizes.md}
          />
          <span className="tracking-wide">{brand.name}</span>
        </Link>

        {/* Right - Controls */}
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
          <div className="relative hidden sm:block" ref={settingsRef}>
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
          
          <Link
            to="/pools"
            className="btn-primary py-2 text-sm"
          >
            Launch App
          </Link>
        </div>
      </div>
    </nav>
  );
}
