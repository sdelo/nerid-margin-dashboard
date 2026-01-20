/**
 * API Response Types
 * 
 * These types represent the JSON responses from the backend API.
 * The backend returns indexer metadata plus event-specific data.
 * 
 * Note: Event types themselves are imported from contracts/deepbook_margin/
 * and should NOT be redefined here.
 */

/**
 * Common indexer metadata fields present in all API event responses
 */
export interface ApiEventMetadata {
  event_digest: string;
  digest: string;
  sender: string;
  checkpoint: number;
  checkpoint_timestamp_ms: number;
  package: string;
  onchain_timestamp: number;
}

/**
 * Generic API event response wrapper
 * T represents the event-specific fields (not the full contract type)
 */
export type ApiEventResponse<T extends Record<string, unknown>> = ApiEventMetadata & T;

/**
 * Query parameters for API requests
 */
export interface QueryParams {
  start_time?: number; // Unix timestamp in SECONDS (server converts to ms)
  end_time?: number; // Unix timestamp in SECONDS (server converts to ms)
  limit?: number; // Maximum number of results
  margin_pool_id?: string;
  margin_manager_id?: string;
  supplier?: string; // For asset_supplied/asset_withdrawn (SupplierCap ID)
  deepbook_pool_id?: string; // For margin_manager_states
  max_risk_ratio?: number; // For margin_manager_states
  pool_id?: string; // For deepbook pool queries
}

/**
 * Time range selection for UI components
 */
export type TimeRange = '1W' | '1M' | '3M' | 'YTD' | 'ALL';

/**
 * Helper to convert TimeRange to start/end timestamps
 * Returns timestamps in SECONDS (as expected by the server)
 */
export function timeRangeToParams(range: TimeRange): { start_time: number; end_time: number } {
  const now = Date.now();
  const end_time = Math.floor(now / 1000); // Convert to seconds

  let start_time: number;
  switch (range) {
    case '1W':
      start_time = Math.floor((now - 7 * 24 * 60 * 60 * 1000) / 1000);
      break;
    case '1M':
      start_time = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
      break;
    case '3M':
      start_time = Math.floor((now - 90 * 24 * 60 * 60 * 1000) / 1000);
      break;
    case 'YTD':
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      start_time = Math.floor(yearStart.getTime() / 1000);
      break;
    case 'ALL':
      start_time = 0; // Beginning of time
      break;
  }

  return { start_time, end_time };
}

/**
 * Get default time range for API queries (1 year from now)
 * Returns timestamps in SECONDS
 */
export function getDefaultTimeRange(): { start_time: number; end_time: number } {
  const now = Date.now();
  const end_time = Math.floor(now / 1000); // Current time in seconds
  const start_time = 1 // begining of history
  return { start_time, end_time };
}

/**
 * Build query string from params
 */
export function buildQueryString(params: QueryParams): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

