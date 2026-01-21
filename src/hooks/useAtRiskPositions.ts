import React from 'react';
import {
  fetchMarginManagerStates,
  fetchLatestDeepbookPoolConfig,
  type MarginManagerStateResponse,
  type DeepbookPoolRegisteredEventResponse,
  type DeepbookPoolConfigUpdatedEventResponse,
} from '../features/lending/api/events';
import { useAppNetwork } from '../context/AppNetworkContext';

/**
 * Processed at-risk position with calculated fields
 */
export interface AtRiskPosition {
  // Core identifiers
  marginManagerId: string;
  deepbookPoolId: string;
  
  // Risk metrics
  riskRatio: number;                    // Current risk ratio (1.0 = 100%)
  liquidationThreshold: number;         // Pool's liquidation threshold
  distanceToLiquidation: number;        // Percentage distance (negative = liquidatable)
  isLiquidatable: boolean;              // Can be liquidated now
  
  // Asset values (in native units)
  baseAsset: number;
  quoteAsset: number;
  baseDebt: number;
  quoteDebt: number;
  
  // USD values
  baseAssetUsd: number;
  quoteAssetUsd: number;
  baseDebtUsd: number;
  quoteDebtUsd: number;
  totalDebtUsd: number;
  
  // Price info
  basePythPrice: number;
  basePythDecimals: number;
  quotePythPrice: number;
  quotePythDecimals: number;
  
  // Asset symbols
  baseAssetSymbol: string;
  quoteAssetSymbol: string;
  
  // Pool info
  baseMarginPoolId: string | null;
  quoteMarginPoolId: string | null;
  
  // Profitability estimate
  estimatedRewardUsd: number;
  userLiquidationRewardPct: number;
  poolLiquidationRewardPct: number;
  
  // Freshness
  updatedAt: Date;
}

export interface AtRiskPositionsResult {
  positions: AtRiskPosition[];
  liquidatableCount: number;
  atRiskCount: number;              // Positions within 20% of liquidation
  totalDebtAtRiskUsd: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  lastUpdated: Date | null;
}

/**
 * Risk ratio thresholds for categorization
 */
const AT_RISK_BUFFER = 0.20; // 20% buffer above liquidation threshold

/**
 * Convert Pyth price to USD value
 * Note: The API returns amounts already in human-readable units (e.g., 46.21 SUI, not smallest units)
 */
function pythPriceToUsd(
  amount: number,
  pythPrice: number,
  pythDecimals: number
): number {
  if (!pythPrice || pythDecimals === null || pythDecimals === undefined) return 0;
  
  // Pyth prices are scaled by 10^pythDecimals
  // Amount is already in human-readable form from the API
  const price = pythPrice / Math.pow(10, Math.abs(pythDecimals));
  
  return amount * price;
}

/**
 * Hook to fetch and process at-risk margin positions
 */
export function useAtRiskPositions(
  deepbookPoolId?: string,
  maxRiskRatio: number = 10.0  // Default: fetch all positions (highest observed ~6x)
): AtRiskPositionsResult {
  const { serverUrl } = useAppNetwork();
  
  const [positions, setPositions] = React.useState<AtRiskPosition[]>([]);
  const [poolConfig, setPoolConfig] = React.useState<
    DeepbookPoolRegisteredEventResponse | DeepbookPoolConfigUpdatedEventResponse | null
  >(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  // Track if this is the initial fetch (vs a refresh)
  const hasInitialDataRef = React.useRef(false);

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Only clear data on initial fetch or error recovery - not on refreshes
      // This prevents chart blinking when data updates on interval
      if (!hasInitialDataRef.current) {
        setPositions([]);
      }

      // Fetch margin manager states with risk ratio filter
      const states = await fetchMarginManagerStates({
        max_risk_ratio: maxRiskRatio,
        deepbook_pool_id: deepbookPoolId,
      });

      // Get pool config for liquidation thresholds
      // Use the first state's pool ID if not specified
      const poolIdToFetch = deepbookPoolId || states[0]?.deepbook_pool_id;
      let config: DeepbookPoolRegisteredEventResponse | DeepbookPoolConfigUpdatedEventResponse | null = null;
      
      if (poolIdToFetch) {
        config = await fetchLatestDeepbookPoolConfig(poolIdToFetch);
        setPoolConfig(config);
      }

      // Get liquidation threshold from config (default to 1.05 if not found)
      const liquidationThreshold = config?.config_json?.risk_ratios?.liquidation_risk_ratio
        ? Number(config.config_json.risk_ratios.liquidation_risk_ratio) / 1e9
        : 1.05;
      
      const userLiquidationRewardPct = config?.config_json?.user_liquidation_reward
        ? Number(config.config_json.user_liquidation_reward) / 1e9
        : 0.02;
      
      const poolLiquidationRewardPct = config?.config_json?.pool_liquidation_reward
        ? Number(config.config_json.pool_liquidation_reward) / 1e9
        : 0.01;

      // Process states into AtRiskPosition objects
      const processed: AtRiskPosition[] = states
        .filter((state: MarginManagerStateResponse) => {
          // Only include positions with active loans (non-zero debt)
          const hasDebt = 
            (state.base_debt && parseFloat(state.base_debt) > 0) ||
            (state.quote_debt && parseFloat(state.quote_debt) > 0);
          return hasDebt && state.risk_ratio;
        })
        .map((state: MarginManagerStateResponse) => {
          const riskRatio = state.risk_ratio ? parseFloat(state.risk_ratio) : 0;
          
          // Parse asset values
          const baseAsset = state.base_asset ? parseFloat(state.base_asset) : 0;
          const quoteAsset = state.quote_asset ? parseFloat(state.quote_asset) : 0;
          const baseDebt = state.base_debt ? parseFloat(state.base_debt) : 0;
          const quoteDebt = state.quote_debt ? parseFloat(state.quote_debt) : 0;
          
          // Calculate USD values (API returns amounts already in human-readable form)
          const baseAssetUsd = pythPriceToUsd(
            baseAsset,
            state.base_pyth_price || 0,
            state.base_pyth_decimals ?? 0
          );
          const quoteAssetUsd = pythPriceToUsd(
            quoteAsset,
            state.quote_pyth_price || 0,
            state.quote_pyth_decimals ?? 0
          );
          const baseDebtUsd = pythPriceToUsd(
            baseDebt,
            state.base_pyth_price || 0,
            state.base_pyth_decimals ?? 0
          );
          const quoteDebtUsd = pythPriceToUsd(
            quoteDebt,
            state.quote_pyth_price || 0,
            state.quote_pyth_decimals ?? 0
          );
          
          const totalDebtUsd = baseDebtUsd + quoteDebtUsd;
          
          // Calculate distance to liquidation
          const distanceToLiquidation = ((riskRatio - liquidationThreshold) / liquidationThreshold) * 100;
          const isLiquidatable = riskRatio <= liquidationThreshold;
          
          // Estimate reward (total reward = user + pool reward percentages)
          const totalRewardPct = userLiquidationRewardPct + poolLiquidationRewardPct;
          const estimatedRewardUsd = totalDebtUsd * totalRewardPct;

          return {
            marginManagerId: state.margin_manager_id,
            deepbookPoolId: state.deepbook_pool_id,
            riskRatio,
            liquidationThreshold,
            distanceToLiquidation,
            isLiquidatable,
            baseAsset,
            quoteAsset,
            baseDebt,
            quoteDebt,
            baseAssetUsd,
            quoteAssetUsd,
            baseDebtUsd,
            quoteDebtUsd,
            totalDebtUsd,
            basePythPrice: state.base_pyth_price || 0,
            basePythDecimals: state.base_pyth_decimals || 0,
            quotePythPrice: state.quote_pyth_price || 0,
            quotePythDecimals: state.quote_pyth_decimals || 0,
            baseAssetSymbol: state.base_asset_symbol || 'BASE',
            quoteAssetSymbol: state.quote_asset_symbol || 'QUOTE',
            baseMarginPoolId: state.base_margin_pool_id,
            quoteMarginPoolId: state.quote_margin_pool_id,
            estimatedRewardUsd,
            userLiquidationRewardPct,
            poolLiquidationRewardPct,
            updatedAt: new Date(state.updated_at),
          };
        })
        // Sort by risk ratio (lowest = most at risk first)
        .sort((a, b) => a.riskRatio - b.riskRatio);

      setPositions(processed);
      setLastUpdated(new Date());
      hasInitialDataRef.current = true;
    } catch (err) {
      console.error('Error fetching at-risk positions:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [deepbookPoolId, maxRiskRatio, serverUrl]);

  // Reset initial data flag when network/pool changes (requires fresh fetch)
  React.useEffect(() => {
    hasInitialDataRef.current = false;
    setPositions([]);
  }, [serverUrl, deepbookPoolId]);

  // Initial fetch and refetch on dependency changes
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Calculate summary stats
  const liquidatableCount = positions.filter(p => p.isLiquidatable).length;
  const atRiskThreshold = poolConfig?.config_json?.risk_ratios?.liquidation_risk_ratio
    ? (Number(poolConfig.config_json.risk_ratios.liquidation_risk_ratio) / 1e9) * (1 + AT_RISK_BUFFER)
    : 1.05 * (1 + AT_RISK_BUFFER);
  
  const atRiskCount = positions.filter(p => p.riskRatio <= atRiskThreshold).length;
  const totalDebtAtRiskUsd = positions
    .filter(p => p.riskRatio <= atRiskThreshold)
    .reduce((sum, p) => sum + p.totalDebtUsd, 0);

  return {
    positions,
    liquidatableCount,
    atRiskCount,
    totalDebtAtRiskUsd,
    isLoading,
    error,
    refetch: fetchData,
    lastUpdated,
  };
}

/**
 * Hook to get risk distribution histogram data
 */
export interface RiskDistributionBucket {
  label: string;
  minRatio: number;
  maxRatio: number;
  count: number;
  totalDebtUsd: number;
  color: string;
}

export function useRiskDistribution(positions: AtRiskPosition[]): RiskDistributionBucket[] {
  return React.useMemo(() => {
    // Theme-consistent colors: rose for danger, amber for warning, cyan/teal for safe
    const buckets: RiskDistributionBucket[] = [
      { label: '< 1.05', minRatio: 0, maxRatio: 1.05, count: 0, totalDebtUsd: 0, color: '#fb7185' },      // Rose-400 - Liquidatable
      { label: '1.05-1.10', minRatio: 1.05, maxRatio: 1.10, count: 0, totalDebtUsd: 0, color: '#fbbf24' }, // Amber-400 - Critical
      { label: '1.10-1.20', minRatio: 1.10, maxRatio: 1.20, count: 0, totalDebtUsd: 0, color: '#fcd34d' }, // Amber-300 - Warning
      { label: '1.20-1.50', minRatio: 1.20, maxRatio: 1.50, count: 0, totalDebtUsd: 0, color: '#2dd4bf' }, // Teal-400 - Safe
      { label: '1.50+', minRatio: 1.50, maxRatio: Infinity, count: 0, totalDebtUsd: 0, color: '#22d3ee' }, // Cyan-400 - Very Safe
    ];

    positions.forEach(position => {
      const bucket = buckets.find(
        b => position.riskRatio >= b.minRatio && position.riskRatio < b.maxRatio
      );
      if (bucket) {
        bucket.count++;
        bucket.totalDebtUsd += position.totalDebtUsd;
      }
    });

    return buckets;
  }, [positions]);
}

