import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSuiClient } from '@mysten/dapp-kit';
import { MarginPool } from '../contracts/deepbook_margin/deepbook_margin/margin_pool';
import type { PoolOverview } from '../features/lending/types';

export interface VaultBalanceMap {
  [poolId: string]: number;
}

/**
 * Centralized hook to fetch vault balances for all pools in a SINGLE batched RPC call.
 * 
 * Before this optimization, 5+ components each independently called `getObject` for the
 * same pool IDs (StickyContextStrip, SnapshotStrip, EnhancedPoolAnalytics,
 * LiquidityHealthCheck, PoolCarousel, BackedMarketsTab). With 4 pools that was ~8+
 * individual RPC calls on load + ~8 every 15 seconds.
 * 
 * Now: 1 `multiGetObjects` call every 30 seconds, shared via React Query cache.
 */
export function useVaultBalances(pools: PoolOverview[]) {
  const suiClient = useSuiClient();

  const poolIds = pools.map(p => p.contracts?.marginPoolId).filter(Boolean);
  const queryKey = ['vaultBalances', ...poolIds];

  const { data: vaultBalances = {}, isLoading, error } = useQuery<VaultBalanceMap>({
    queryKey,
    queryFn: async () => {
      if (poolIds.length === 0) return {};

      // Single batched RPC call for all pools
      const _t0 = performance.now();
      const responses = await suiClient.multiGetObjects({
        ids: poolIds as string[],
        options: { showBcs: true },
      });
      console.log(`⏱ [vaultBalances] multiGetObjects RPC: ${(performance.now() - _t0).toFixed(1)}ms`);

      const balances: VaultBalanceMap = {};

      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const pool = pools[i];
        if (!pool || !response.data?.bcs || response.data.bcs.dataType !== 'moveObject') {
          continue;
        }

        try {
          const marginPool = MarginPool.fromBase64(response.data.bcs.bcsBytes);
          const vaultValue = Number(marginPool.vault.value) / (10 ** pool.contracts.coinDecimals);
          balances[pool.id] = vaultValue;
        } catch (err) {
          console.warn(`Failed to parse vault balance for pool ${pool.id}:`, err);
        }
      }

      return balances;
    },
    enabled: poolIds.length > 0,
    staleTime: 15_000,       // Consider data fresh for 15s
    refetchInterval: 30_000, // Auto-refetch every 30s
    retry: 2,
    refetchOnWindowFocus: false,
  });

  return { vaultBalances, isLoading, error };
}

/**
 * Convenience hook to get a single pool's vault balance from the shared cache.
 */
export function useVaultBalance(pools: PoolOverview[], poolId: string | undefined) {
  const { vaultBalances, isLoading, error } = useVaultBalances(pools);
  const vaultBalance = poolId ? (vaultBalances[poolId] ?? null) : null;
  return { vaultBalance, isLoading, error };
}
