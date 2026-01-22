import { apiClient } from '../../../lib/api/client';
import type { QueryParams, ApiEventResponse } from './types';
import { getDefaultTimeRange } from './types';

/**
 * API Event Response Types
 * These match the JSON structure returned by the backend
 */

// Loan Borrowed Event Response
export interface LoanBorrowedEventResponse extends ApiEventResponse<{
  margin_manager_id: string;
  margin_pool_id: string;
  loan_amount: string;
  loan_shares: string;
}> {}

// Loan Repaid Event Response
export interface LoanRepaidEventResponse extends ApiEventResponse<{
  margin_manager_id: string;
  margin_pool_id: string;
  repay_amount: string;
  repay_shares: string;
}> {}

// Liquidation Event Response
export interface LiquidationEventResponse extends ApiEventResponse<{
  margin_manager_id: string;
  margin_pool_id: string;
  liquidation_amount: string;
  pool_reward: string;
  pool_default: string;
  risk_ratio: string;
}> {}

// Asset Supplied Event Response
export interface AssetSuppliedEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  asset_type: string;
  supplier: string;
  amount: string;
  shares: string;
}> {}

// Asset Withdrawn Event Response
export interface AssetWithdrawnEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  asset_type: string;
  supplier: string;
  amount: string;
  shares: string;
}> {}

// Interest Params Updated Event Response
export interface InterestParamsUpdatedEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  pool_cap_id: string;
  config_json: {
    base_rate: string | number;
    base_slope: string | number;
    optimal_utilization: string | number;
    excess_slope: string | number;
  };
  // Alias for backwards compatibility
  interest_config?: {
    base_rate: string | number;
    base_slope: string | number;
    optimal_utilization: string | number;
    excess_slope: string | number;
  };
}> {}

// Margin Pool Config Updated Event Response
export interface MarginPoolConfigUpdatedEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  pool_cap_id: string;
  margin_pool_config: {
    supply_cap: string;
    max_utilization_rate: string;
    protocol_spread: string;
    min_borrow: string;
  };
}> {}

// Margin Pool Created Event Response
export interface MarginPoolCreatedEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  maintainer_cap_id: string;
  asset_type: string;
  config_json: unknown; // JSON string or object
}> {}

// Deepbook Pool Updated Event Response
export interface DeepbookPoolUpdatedEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  deepbook_pool_id: string;
  pool_cap_id: string;
  enabled: boolean;
}> {}

// Deepbook Pool Registered Event Response
export interface DeepbookPoolRegisteredEventResponse extends ApiEventResponse<{
  pool_id: string;
  config_json: {
    enabled: boolean;
    risk_ratios: {
      min_borrow_risk_ratio: number;
      liquidation_risk_ratio: number;
      min_withdraw_risk_ratio: number;
      target_liquidation_risk_ratio: number;
    };
    extra_fields: {
      contents: unknown[];
    };
    base_margin_pool_id: string;
    quote_margin_pool_id: string;
    pool_liquidation_reward: number;
    user_liquidation_reward: number;
  };
}> {}

// Deepbook Pool Config Updated Event Response
export interface DeepbookPoolConfigUpdatedEventResponse extends ApiEventResponse<{
  pool_id: string;
  config_json: {
    enabled: boolean;
    risk_ratios: {
      min_borrow_risk_ratio: number;
      liquidation_risk_ratio: number;
      min_withdraw_risk_ratio: number;
      target_liquidation_risk_ratio: number;
    };
    extra_fields: {
      contents: unknown[];
    };
    base_margin_pool_id: string;
    quote_margin_pool_id: string;
    pool_liquidation_reward: number;
    user_liquidation_reward: number;
  };
}> {}

// Maintainer Fees Withdrawn Event Response
export interface MaintainerFeesWithdrawnEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  margin_pool_cap_id: string;
  maintainer_fees: string;
}> {}

// Protocol Fees Withdrawn Event Response
export interface ProtocolFeesWithdrawnEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  protocol_fees: string;
}> {}

// Referral Fees Claimed Event Response
export interface ReferralFeesClaimedEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  referral_id: string;
  owner: string;
  fees: string;
}> {}

// Supply Referral Minted Event Response
export interface SupplyReferralMintedEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  supply_referral_id: string;
  owner: string;
}> {}

// Protocol Fees Increased Event Response (with detailed breakdown)
export interface ProtocolFeesIncreasedEventResponse extends ApiEventResponse<{
  margin_pool_id: string;
  total_shares: string;
  referral_fees: string;
  maintainer_fees: string;
  protocol_fees: string;
}> {}

// Margin Manager Created Event Response
export interface MarginManagerCreatedEventResponse extends ApiEventResponse<{
  margin_manager_id: string;
  balance_manager_id: string;
  deepbook_pool_id: string | null;
  base_margin_pool_id?: string | null;
  quote_margin_pool_id?: string | null;
}> {}

// Margin Managers Info Response
export interface MarginManagersInfoResponse {
  margin_manager_id: string;
  deepbook_pool_id: string | null;
  base_asset_id: string | null;
  base_asset_symbol: string | null;
  quote_asset_id: string | null;
  quote_asset_symbol: string | null;
  base_margin_pool_id: string | null;
  quote_margin_pool_id: string | null;
}

// Margin Manager State Response - pre-computed state with risk ratios
export interface MarginManagerStateResponse {
  id: number;
  margin_manager_id: string;
  deepbook_pool_id: string;
  base_margin_pool_id: string | null;
  quote_margin_pool_id: string | null;
  base_asset_id: string | null;
  base_asset_symbol: string | null;
  quote_asset_id: string | null;
  quote_asset_symbol: string | null;
  risk_ratio: string | null;           // Pre-computed risk ratio (9 decimal precision)
  base_asset: string | null;           // Base asset value
  quote_asset: string | null;          // Quote asset value
  base_debt: string | null;            // Base debt amount
  quote_debt: string | null;           // Quote debt amount
  base_pyth_price: number | null;      // Pyth price for base asset
  base_pyth_decimals: number | null;   // Pyth decimals for base asset
  quote_pyth_price: number | null;     // Pyth price for quote asset
  quote_pyth_decimals: number | null;  // Pyth decimals for quote asset
  created_at: string;
  updated_at: string;                  // Freshness indicator
}

// Margin Manager States Response (array of state objects)
export type MarginManagerStatesResponse = MarginManagerStateResponse[];

/**
 * Helper function to build query string from params
 * Automatically adds default time range (1 year) if start_time/end_time are not provided
 */
function buildQuery(params?: QueryParams): string {
  // Merge with default time range if not provided
  const defaultTimeRange = getDefaultTimeRange();
  const mergedParams: QueryParams = {
    start_time: defaultTimeRange.start_time,
    end_time: defaultTimeRange.end_time,
    limit: 1000,
    ...params, // User-provided params override defaults
  };
  
  const searchParams = new URLSearchParams();
  
  Object.entries(mergedParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Fetch loan borrowed events
 */
export async function fetchLoanBorrowed(
  params?: QueryParams
): Promise<LoanBorrowedEventResponse[]> {
  return apiClient.get<LoanBorrowedEventResponse[]>(`/loan_borrowed${buildQuery(params)}`);
}

/**
 * Fetch loan repaid events
 */
export async function fetchLoanRepaid(
  params?: QueryParams
): Promise<LoanRepaidEventResponse[]> {
  return apiClient.get<LoanRepaidEventResponse[]>(`/loan_repaid${buildQuery(params)}`);
}

/**
 * Fetch liquidation events
 */
export async function fetchLiquidations(
  params?: QueryParams
): Promise<LiquidationEventResponse[]> {
  return apiClient.get<LiquidationEventResponse[]>(`/liquidation${buildQuery(params)}`);
}

/**
 * Fetch asset supplied events
 */
export async function fetchAssetSupplied(
  params?: QueryParams
): Promise<AssetSuppliedEventResponse[]> {
  return apiClient.get<AssetSuppliedEventResponse[]>(`/asset_supplied${buildQuery(params)}`);
}

/**
 * Fetch asset withdrawn events
 */
export async function fetchAssetWithdrawn(
  params?: QueryParams
): Promise<AssetWithdrawnEventResponse[]> {
  return apiClient.get<AssetWithdrawnEventResponse[]>(`/asset_withdrawn${buildQuery(params)}`);
}

/**
 * Fetch interest params updated events
 */
export async function fetchInterestParamsUpdated(
  params?: QueryParams
): Promise<InterestParamsUpdatedEventResponse[]> {
  return apiClient.get<InterestParamsUpdatedEventResponse[]>(`/interest_params_updated${buildQuery(params)}`);
}

/**
 * Fetch margin pool config updated events
 */
export async function fetchMarginPoolConfigUpdated(
  params?: QueryParams
): Promise<MarginPoolConfigUpdatedEventResponse[]> {
  return apiClient.get<MarginPoolConfigUpdatedEventResponse[]>(`/margin_pool_config_updated${buildQuery(params)}`);
}

/**
 * Fetch margin pool created events
 */
export async function fetchMarginPoolCreated(
  params?: QueryParams
): Promise<MarginPoolCreatedEventResponse[]> {
  return apiClient.get<MarginPoolCreatedEventResponse[]>(`/margin_pool_created${buildQuery(params)}`);
}

/**
 * Fetch deepbook pool updated events
 */
export async function fetchDeepbookPoolUpdated(
  params?: QueryParams
): Promise<DeepbookPoolUpdatedEventResponse[]> {
  return apiClient.get<DeepbookPoolUpdatedEventResponse[]>(`/deepbook_pool_updated${buildQuery(params)}`);
}

/**
 * Fetch maintainer fees withdrawn events
 */
export async function fetchMaintainerFeesWithdrawn(
  params?: QueryParams
): Promise<MaintainerFeesWithdrawnEventResponse[]> {
  return apiClient.get<MaintainerFeesWithdrawnEventResponse[]>(`/maintainer_fees_withdrawn${buildQuery(params)}`);
}

/**
 * Fetch protocol fees withdrawn events
 */
export async function fetchProtocolFeesWithdrawn(
  params?: QueryParams
): Promise<ProtocolFeesWithdrawnEventResponse[]> {
  return apiClient.get<ProtocolFeesWithdrawnEventResponse[]>(`/protocol_fees_withdrawn${buildQuery(params)}`);
}

/**
 * Fetch protocol fees increased events
 */
export async function fetchProtocolFeesIncreased(
  params?: QueryParams
): Promise<ProtocolFeesIncreasedEventResponse[]> {
  return apiClient.get<ProtocolFeesIncreasedEventResponse[]>(`/protocol_fees_increased${buildQuery(params)}`);
}

/**
 * Fetch referral fees claimed events
 */
export async function fetchReferralFeesClaimed(
  params?: QueryParams & { referral_id?: string; owner?: string }
): Promise<ReferralFeesClaimedEventResponse[]> {
  return apiClient.get<ReferralFeesClaimedEventResponse[]>(`/referral_fees_claimed${buildQuery(params)}`);
}

/**
 * Fetch supply referral minted events (all referrals created in the system)
 */
export async function fetchSupplyReferralMinted(
  params?: QueryParams & { owner?: string }
): Promise<SupplyReferralMintedEventResponse[]> {
  return apiClient.get<SupplyReferralMintedEventResponse[]>(`/supply_referral_minted${buildQuery(params)}`);
}

/**
 * Fetch margin manager created events
 */
export async function fetchMarginManagerCreated(
  params?: QueryParams
): Promise<MarginManagerCreatedEventResponse[]> {
  return apiClient.get<MarginManagerCreatedEventResponse[]>(`/margin_manager_created${buildQuery(params)}`);
}

/**
 * Fetch margin managers info
 */
export async function fetchMarginManagersInfo(): Promise<MarginManagersInfoResponse[]> {
  return apiClient.get<MarginManagersInfoResponse[]>('/margin_managers_info');
}

/**
 * Query parameters specific to margin_manager_states endpoint
 */
export interface MarginManagerStatesQueryParams {
  max_risk_ratio?: number;    // Filter by maximum risk ratio
  deepbook_pool_id?: string;  // Filter by DeepBook pool
}

/**
 * Fetch margin manager states with pre-computed risk ratios
 * This endpoint doesn't use time-based filtering
 */
export async function fetchMarginManagerStates(
  params?: MarginManagerStatesQueryParams
): Promise<MarginManagerStatesResponse> {
  const searchParams = new URLSearchParams();
  
  if (params?.max_risk_ratio !== undefined) {
    searchParams.append('max_risk_ratio', String(params.max_risk_ratio));
  }
  if (params?.deepbook_pool_id) {
    searchParams.append('deepbook_pool_id', params.deepbook_pool_id);
  }
  
  const queryString = searchParams.toString();
  const path = queryString ? `/margin_manager_states?${queryString}` : '/margin_manager_states';
  
  return apiClient.get<MarginManagerStatesResponse>(path);
}

/**
 * Fetch deepbook pool registered events
 */
export async function fetchDeepbookPoolRegistered(
  params?: QueryParams
): Promise<DeepbookPoolRegisteredEventResponse[]> {
  return apiClient.get<DeepbookPoolRegisteredEventResponse[]>(`/deepbook_pool_registered${buildQuery(params)}`);
}

/**
 * Fetch deepbook pool config updated events
 */
export async function fetchDeepbookPoolConfigUpdated(
  params?: QueryParams
): Promise<DeepbookPoolConfigUpdatedEventResponse[]> {
  return apiClient.get<DeepbookPoolConfigUpdatedEventResponse[]>(`/deepbook_pool_config_updated${buildQuery(params)}`);
}

/**
 * Get the latest config for a deepbook pool by merging registered and config updated events
 */
export async function fetchLatestDeepbookPoolConfig(
  poolId: string
): Promise<DeepbookPoolRegisteredEventResponse | DeepbookPoolConfigUpdatedEventResponse | null> {
  try {
    const [registeredEvents, configUpdatedEvents] = await Promise.all([
      fetchDeepbookPoolRegistered({ pool_id: poolId }),
      fetchDeepbookPoolConfigUpdated({ pool_id: poolId }),
    ]);

    // Combine and sort by timestamp
    const allEvents = [
      ...registeredEvents.map(e => ({ ...e, source: 'registered' as const })),
      ...configUpdatedEvents.map(e => ({ ...e, source: 'updated' as const })),
    ].sort((a, b) => b.onchain_timestamp - a.onchain_timestamp);

    return allEvents[0] || null;
  } catch (err) {
    console.error(`Error in fetchLatestDeepbookPoolConfig for ${poolId}:`, err);
    throw err;
  }
}

