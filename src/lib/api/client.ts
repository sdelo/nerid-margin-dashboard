import { getApiBaseUrl } from '../../config/api';

/**
 * API Error class for handling API-specific errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Options for API requests
 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Base API client for making requests to the backend
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Get base URL without trailing slash to avoid double slashes in URL construction
    this.baseUrl = baseUrl || getApiBaseUrl();
  }

  /**
   * Update the base URL
   */
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Make a request to the API
   */
  async request<T>(
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      signal,
    } = options;

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const requestHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal,
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        let errorData: unknown;

        try {
          errorData = await response.json();
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = String((errorData as { error: unknown }).error);
          }
        } catch {
          // If JSON parsing fails, use default error message
        }

        throw new ApiError(errorMessage, response.status, errorData);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return null as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        // Network error or other fetch errors
        throw new ApiError(`Network error: ${error.message}`, undefined, error);
      }

      throw new ApiError('Unknown error occurred', undefined, error);
    }
  }

  /**
   * GET request helper
   */
  async get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * POST request helper
   */
  async post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

