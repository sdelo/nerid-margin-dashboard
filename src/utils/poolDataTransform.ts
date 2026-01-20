import { MarginPool } from '../contracts/deepbook_margin/deepbook_margin/margin_pool';
import { calculatePoolRates } from './interestRates';
import { getContracts, getMarginPools, type NetworkType } from '../config/contracts';
import type { PoolOverview } from '../features/lending/types';

/**
 * Converts blockchain values from smallest units to human-readable units
 * Example: 1000000000 MIST (1e9) -> 1 SUI
 */
function convertFromSmallestUnits(value: string | number | bigint, decimals: number): number {
  const divisor = Number(10 ** decimals);
  return Number(value) / divisor;
}

/**
 * Converts 9-decimal format to percentage (for interest rates and config values)
 * Example: 900000000 (9 decimals) = 0.9 (90%)
 */
function nineDecimalToPercent(nineDecimal: string | number | bigint): number {
  return Number(nineDecimal) / 1_000_000_000;
}

/**
 * Detects asset info from the pool type string
 */
function detectAssetFromType(assetType: string, network: NetworkType): { asset: string; decimals: number } {
  // Check for known asset patterns
  if (assetType.includes('::sui::SUI')) {
    return { asset: 'SUI', decimals: 9 };
  }
  if (assetType.includes('::usdc::USDC')) {
    return { asset: 'USDC', decimals: 6 };
  }
  if (assetType.includes('::deep::DEEP')) {
    return { asset: 'DEEP', decimals: 6 };
  }
  if (assetType.includes('::wal::WAL')) {
    return { asset: 'WAL', decimals: 9 };
  }
  // Legacy testnet DBUSDC
  if (assetType.includes('::DBUSDC::DBUSDC')) {
    return { asset: 'DBUSDC', decimals: 6 };
  }
  // Default fallback
  return { asset: 'UNKNOWN', decimals: 9 };
}

/**
 * Transforms raw BCS data into a PoolOverview object
 * Handles unit conversion, type conversion, and rate calculations
 */
export function transformMarginPoolData(
  marginPool: typeof MarginPool["$inferInput"], // The parsed MarginPool object from BCS
  poolId: string,
  assetType: string,
  network: NetworkType = 'mainnet'
): PoolOverview {
  // Detect asset type and decimals from the pool type string
  const { asset, decimals } = detectAssetFromType(assetType, network);

  // Get network-specific contracts
  const networkContracts = getContracts(network);
  const marginPools = getMarginPools(network);
  
  // Find the pool config for this asset
  const poolConfig = marginPools.find(p => p.asset === asset);
  
  // Access the parsed MarginPool object fields
  const state = {
    supply: convertFromSmallestUnits(marginPool.state.total_supply, decimals),
    borrow: convertFromSmallestUnits(marginPool.state.total_borrow, decimals),
    supply_shares: convertFromSmallestUnits(marginPool.state.supply_shares, decimals),
    borrow_shares: convertFromSmallestUnits(marginPool.state.borrow_shares, decimals),
    last_update_timestamp: Number(marginPool.state.last_update_timestamp), 
  };

  const protocolConfig = {
    margin_pool_config: {
      // Supply cap and min borrow are in smallest units of the underlying token
      supply_cap: convertFromSmallestUnits(marginPool.config.margin_pool_config.supply_cap, decimals),
      min_borrow: convertFromSmallestUnits(marginPool.config.margin_pool_config.min_borrow, decimals),
      // Config values are always in 9-decimal format regardless of underlying token decimals
      max_utilization_rate: nineDecimalToPercent(marginPool.config.margin_pool_config.max_utilization_rate),
      protocol_spread: nineDecimalToPercent(marginPool.config.margin_pool_config.protocol_spread),
    },
    interest_config: {
      // Interest rates are in 9-decimal format
      base_rate: nineDecimalToPercent(marginPool.config.interest_config.base_rate),
      base_slope: nineDecimalToPercent(marginPool.config.interest_config.base_slope),
      optimal_utilization: nineDecimalToPercent(marginPool.config.interest_config.optimal_utilization),
      excess_slope: nineDecimalToPercent(marginPool.config.interest_config.excess_slope),
    },
  };

  // Get contract metadata from pool config or use defaults
  const contracts = poolConfig 
    ? {
        registryId: networkContracts.MARGIN_REGISTRY_ID,
        marginPoolId: poolConfig.poolId,
        marginPoolType: poolConfig.poolType,
        referralId: poolConfig.referralId,
        coinType: poolConfig.poolType,
        coinDecimals: poolConfig.decimals,
        coinDepositSourceId: poolConfig.coinId,
        tradingPair: poolConfig.tradingPair,
      }
    : {
        registryId: networkContracts.MARGIN_REGISTRY_ID,
        marginPoolId: poolId,
        marginPoolType: assetType,
        referralId: undefined,
        coinType: assetType,
        coinDecimals: decimals,
        coinDepositSourceId: networkContracts.SUI_ID, // fallback
        tradingPair: undefined,
      };

  // Create temporary pool object for rate calculations
  const tempPool: PoolOverview = {
    id: poolId,
    asset,
    state,
    protocolConfig,
    contracts,
    ui: {
      aprSupplyPct: 0, // Will be calculated below
      depositors: 0,
      ageDays: 0,
      deepbookPoolId: '0x…DB00',
    },
  };

  // Calculate rates using utility function
  const { supplyApr } = calculatePoolRates(tempPool);

  // Return final pool overview with calculated rates
  return {
    ...tempPool,
    ui: {
      ...tempPool.ui,
      aprSupplyPct: supplyApr,
      depositors: Number(marginPool.positions.positions.size),
      ageDays: 0, // Not available from blockchain data
    },
  };
}
