import { NETWORK_CONFIGS, DEFAULT_NETWORK } from './networks';

/**
 * API Configuration
 * 
 * Supports environment-based API URL configuration for different environments.
 * Set API_URL environment variable to override the default.
 */

function getApiBaseUrlFromEnv(): string {
  // Check for environment variable first
  if (typeof process !== 'undefined' && process.env && process.env.API_URL) {
    return process.env.API_URL;
  }

  // Use the default network's indexer URL
  // This ensures we don't try to hit localhost:9008 unless explicitly configured
  return NETWORK_CONFIGS[DEFAULT_NETWORK].serverUrl;
}

export const API_CONFIG = {
  baseUrl: getApiBaseUrlFromEnv(),
} as const;

/**
 * Get the base URL for API requests
 */
export function getApiBaseUrl(): string {
  return API_CONFIG.baseUrl;
}

/**
 * Build a full API URL from a path
 */
export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl().replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

