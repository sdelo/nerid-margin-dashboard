import { useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';
import { useAppNetwork } from '../context/AppNetworkContext';

/**
 * Wrapper around useQuery that automatically includes serverUrl in the query key.
 * This ensures queries refetch when the server/indexer changes.
 */
export function useQueryWithServer<TData = unknown, TError = Error>(
  options: Omit<UseQueryOptions<TData, TError>, 'queryKey'> & {
    queryKey: QueryKey;
  }
) {
  const { serverUrl } = useAppNetwork();
  
  // Prepend serverUrl to the query key so React Query treats it as a different query
  const queryKeyWithServer: QueryKey = ['server', serverUrl, ...options.queryKey];
  
  return useQuery<TData, TError>({
    ...options,
    queryKey: queryKeyWithServer,
  });
}










