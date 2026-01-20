import { useQuery } from "@tanstack/react-query";

/**
 * Response type for the /status endpoint
 */
export interface IndexerStatusResponse {
  status: "HEALTHY" | "UNHEALTHY";
  latest_onchain_checkpoint: number;
  current_time_ms: number;
  earliest_checkpoint: number;
  max_lag_pipeline: string;
  max_checkpoint_lag: number;
  max_time_lag_seconds: number;
  pipelines: Array<{
    pipeline: string;
    indexed_checkpoint: number;
    indexed_epoch: number;
    indexed_timestamp_ms: number;
    checkpoint_lag: number;
    time_lag_seconds: number;
    latest_onchain_checkpoint: number;
  }>;
}

export interface IndexerStatus {
  isHealthy: boolean;
  isLoading: boolean;
  isError: boolean;
  /** The pipeline with the most lag (among lending-relevant pipelines) */
  maxLagPipeline: string | null;
  /** Maximum time lag in seconds across lending-relevant pipelines */
  maxTimeLagSeconds: number | null;
  /** Human-readable lag description */
  lagDescription: string | null;
  /** Raw response data */
  raw: IndexerStatusResponse | null;
}

/**
 * Pipelines that are relevant for lending functionality.
 * We only care about these when determining if the indexer is "healthy enough" for lending.
 */
const LENDING_PIPELINES = [
  "asset_supplied",
  "asset_withdrawn",
  "loan_borrowed",
  "loan_repaid",
  "liquidation",
];

/**
 * Maximum acceptable lag in seconds before we consider the indexer unhealthy for lending.
 * 5 minutes = 300 seconds should be sufficient for most use cases.
 */
const MAX_ACCEPTABLE_LAG_SECONDS = 300;

/**
 * Formats seconds into a human-readable duration
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} day${days > 1 ? "s" : ""}`;
}

/**
 * Hook to fetch and monitor the indexer status.
 * Returns whether the indexer is healthy and any lag information.
 * 
 * The indexer is considered unhealthy when:
 * - The status endpoint returns "UNHEALTHY"
 * - The request fails (network error, etc.)
 * 
 * When unhealthy, deposit/withdraw history and interest calculations
 * may be inaccurate or unavailable.
 * 
 * @param serverUrl - The base URL of the indexer server
 */
export function useIndexerStatus(serverUrl: string): IndexerStatus {

  const { data, isLoading, isError } = useQuery({
    queryKey: ["indexer-status", serverUrl],
    queryFn: async (): Promise<IndexerStatusResponse> => {
      const response = await fetch(`${serverUrl}/status`);
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      return response.json();
    },
    // Check status every 30 seconds
    refetchInterval: 30000,
    // Don't refetch on window focus to avoid flickering
    refetchOnWindowFocus: false,
    // Keep stale data while refetching
    staleTime: 15000,
    // Retry a couple times before giving up
    retry: 2,
    retryDelay: 1000,
  });

  if (isLoading) {
    return {
      isHealthy: true, // Assume healthy while loading
      isLoading: true,
      isError: false,
      maxLagPipeline: null,
      maxTimeLagSeconds: null,
      lagDescription: null,
      raw: null,
    };
  }

  if (isError || !data) {
    return {
      isHealthy: false,
      isLoading: false,
      isError: true,
      maxLagPipeline: null,
      maxTimeLagSeconds: null,
      lagDescription: "Unable to reach indexer",
      raw: null,
    };
  }

  // Find the lending-relevant pipelines and calculate their max lag
  const lendingPipelines = data.pipelines.filter((p) =>
    LENDING_PIPELINES.includes(p.pipeline)
  );

  // Get the max lag among lending pipelines
  let maxLendingLag = 0;
  let maxLagPipeline: string | null = null;

  for (const pipeline of lendingPipelines) {
    if (pipeline.time_lag_seconds > maxLendingLag) {
      maxLendingLag = pipeline.time_lag_seconds;
      maxLagPipeline = pipeline.pipeline;
    }
  }

  // Consider healthy if:
  // 1. Overall status is HEALTHY, OR
  // 2. The lending-relevant pipelines are within acceptable lag
  const isHealthy =
    data.status === "HEALTHY" || maxLendingLag <= MAX_ACCEPTABLE_LAG_SECONDS;

  // Generate human-readable lag description
  let lagDescription: string | null = null;
  if (!isHealthy && maxLendingLag > 0) {
    lagDescription = `Data is ${formatDuration(maxLendingLag)} behind`;
  }

  return {
    isHealthy,
    isLoading: false,
    isError: false,
    maxLagPipeline,
    maxTimeLagSeconds: maxLendingLag,
    lagDescription,
    raw: data,
  };
}
