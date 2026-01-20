import type { FC } from "react";
import React from "react";

type Props = {
  asset: string | null;
  iconUrl?: string;
  isVisible: boolean;
};

export const PoolSwitchToast: FC<Props> = ({ asset, iconUrl, isVisible }) => {
  if (!isVisible || !asset) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up-fade">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0d1a1f]/95 backdrop-blur-xl border border-white/[0.12] rounded-full shadow-2xl">
        <img
          src={
            iconUrl ||
            `https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png`
          }
          alt={asset}
          className="w-5 h-5 rounded-full"
        />
        <span className="text-sm font-medium text-white">
          Switched to <span className="text-[#2dd4bf] font-semibold">{asset}</span>
        </span>
        <svg
          className="w-4 h-4 text-[#2dd4bf]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    </div>
  );
};

export default PoolSwitchToast;
