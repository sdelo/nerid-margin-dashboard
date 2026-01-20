import { apiClient } from '../../../lib/api/client';

/**
 * OHLCV Candle data from the DeepBook indexer
 * Format: [timestamp, open, high, low, close, volume]
 */
export type OHLCVCandle = [number, number, number, number, number, number];

export interface OHLCVResponse {
  candles: OHLCVCandle[];
}

/**
 * Market summary data for a trading pair
 */
export interface MarketSummary {
  trading_pairs: string;
  base_currency: string;
  quote_currency: string;
  last_price: number;
  highest_price_24h: number;
  lowest_price_24h: number;
  price_change_percent_24h: number;
  highest_bid: number;
  lowest_ask: number;
  base_volume: number;
  quote_volume: number;
}

export type OHLCVInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

interface OHLCVParams {
  interval?: OHLCVInterval;
  start_time?: number;
  end_time?: number;
  limit?: number;
}

/**
 * Fetch OHLCV (candlestick) data for a trading pool
 * @param poolName - The pool name (e.g., "SUI_DBUSDC")
 * @param params - Optional query parameters
 */
export async function fetchOHLCV(
  poolName: string,
  params: OHLCVParams = {}
): Promise<OHLCVCandle[]> {
  const queryParams = new URLSearchParams();
  
  if (params.interval) queryParams.set('interval', params.interval);
  if (params.start_time) queryParams.set('start_time', params.start_time.toString());
  if (params.end_time) queryParams.set('end_time', params.end_time.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const queryString = queryParams.toString();
  const url = `/ohclv/${poolName}${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiClient.get<OHLCVResponse>(url);
  return response.candles || [];
}

/**
 * Fetch market summary for all trading pairs
 */
export async function fetchMarketSummary(): Promise<MarketSummary[]> {
  return apiClient.get<MarketSummary[]>('/summary');
}

/**
 * Get market summary for a specific trading pair
 * @param pairName - The trading pair name (e.g., "SUI_DBUSDC")
 */
export async function fetchPairSummary(pairName: string): Promise<MarketSummary | null> {
  const summaries = await fetchMarketSummary();
  // Try exact match first
  let match = summaries.find(s => s.trading_pairs === pairName);
  if (!match) {
    // Try case-insensitive match
    const pairNameLower = pairName.toLowerCase();
    match = summaries.find(s => s.trading_pairs.toLowerCase() === pairNameLower);
  }
  if (!match) {
    // Try matching by base/quote currencies
    const [base, quote] = pairName.split('_');
    if (base && quote) {
      match = summaries.find(s => 
        s.base_currency === base && s.quote_currency === quote
      );
    }
  }
  return match || null;
}

/**
 * Parse candle data into a more usable format
 */
export interface ParsedCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: Date;
}

export function parseCandles(candles: OHLCVCandle[]): ParsedCandle[] {
  return candles.map(([timestamp, open, high, low, close, volume]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    date: new Date(timestamp),
  }));
}
