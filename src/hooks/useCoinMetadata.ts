import React from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';

export interface CoinMetadata {
  name: string;
  symbol: string;
  decimals: number;
  iconUrl: string | null;
  description?: string;
}

// Fallback icons for common assets (used when iconUrl is null or fails to load)
const FALLBACK_ICONS: Record<string, string> = {
  SUI: "https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png?1727791290",
  DBUSDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
  USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
  DEEP: "https://assets.coingecko.com/coins/images/38087/standard/deep.png?1728614086",
  WAL: "https://assets.coingecko.com/coins/images/54016/standard/walrus.jpg?1737525627",
};

/**
 * Hook to fetch coin metadata including icon URL from SUI RPC
 */
export function useCoinMetadata(coinType: string | undefined) {
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ['coinMetadata', coinType],
    queryFn: async (): Promise<CoinMetadata | null> => {
      if (!coinType) return null;
      
      try {
        const metadata = await suiClient.getCoinMetadata({ coinType });
        
        if (!metadata) return null;
        
        return {
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: metadata.decimals,
          iconUrl: metadata.iconUrl || null,
          description: metadata.description,
        };
      } catch (error) {
        console.warn(`Failed to fetch coin metadata for ${coinType}:`, error);
        return null;
      }
    },
    enabled: Boolean(coinType),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (metadata rarely changes)
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    retry: 2,
  });
}

/**
 * Hook to fetch metadata for multiple coin types at once
 */
export function useCoinMetadataBatch(coinTypes: string[]) {
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ['coinMetadataBatch', coinTypes.sort().join(',')],
    queryFn: async (): Promise<Map<string, CoinMetadata>> => {
      const metadataMap = new Map<string, CoinMetadata>();
      
      // Fetch all coin metadata in parallel
      const results = await Promise.allSettled(
        coinTypes.map(async (coinType) => {
          const metadata = await suiClient.getCoinMetadata({ coinType });
          return { coinType, metadata };
        })
      );
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.metadata) {
          const { coinType, metadata } = result.value;
          metadataMap.set(coinType, {
            name: metadata.name,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            iconUrl: metadata.iconUrl || null,
            description: metadata.description,
          });
        }
      }
      
      return metadataMap;
    },
    enabled: coinTypes.length > 0,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  });
}

/**
 * Get the icon URL for an asset, with fallback support
 */
export function getAssetIcon(
  iconUrl: string | null | undefined, 
  assetSymbol: string
): string {
  if (iconUrl) return iconUrl;
  return FALLBACK_ICONS[assetSymbol] || FALLBACK_ICONS['SUI']; // Default fallback
}

/**
 * React component wrapper for coin icons with fallback support
 */
export function CoinIcon({ 
  iconUrl, 
  symbol, 
  className = "w-6 h-6 rounded-full",
  alt 
}: { 
  iconUrl: string | null | undefined;
  symbol: string;
  className?: string;
  alt?: string;
}) {
  const [imgError, setImgError] = React.useState(false);
  const src = imgError ? FALLBACK_ICONS[symbol] : (iconUrl || FALLBACK_ICONS[symbol]);
  
  return (
    <img
      src={src || FALLBACK_ICONS['SUI']}
      alt={alt || `${symbol} icon`}
      className={className}
      onError={() => setImgError(true)}
    />
  );
}
