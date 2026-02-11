import React from 'react';

export type ValueMode = 'usd' | 'native';

interface UsdToggleProps {
  mode: ValueMode;
  onChange: (mode: ValueMode) => void;
  asset: string;
  /** If true, price is unavailable and USD mode is disabled */
  priceUnavailable?: boolean;
}

/**
 * A small pill toggle that lets users switch between USD and native token display.
 */
export function UsdToggle({ mode, onChange, asset, priceUnavailable }: UsdToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
      <button
        onClick={() => onChange('native')}
        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
          mode === 'native'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-white/50 hover:text-white/70'
        }`}
      >
        {asset}
      </button>
      <button
        onClick={() => !priceUnavailable && onChange('usd')}
        disabled={priceUnavailable}
        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
          mode === 'usd'
            ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
            : priceUnavailable
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/50 hover:text-white/70'
        }`}
        title={priceUnavailable ? 'USD price not available for this asset' : 'Show values in USD'}
      >
        USD
      </button>
    </div>
  );
}

export default UsdToggle;
