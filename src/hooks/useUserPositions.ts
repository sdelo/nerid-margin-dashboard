import { useAllPools } from './useAllPools';
import type { UserPosition } from '../features/lending/types';

export type UserPositionsResult = {
  data: UserPosition[];
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
};

export function useUserPositions(userAddress: string | undefined): UserPositionsResult {
  // Use the centralized all pools hook which fetches all user positions
  const { userPositions, isLoading, error, refetch } = useAllPools(userAddress);

  return {
    data: userPositions,
    error,
    isLoading,
    refetch,
  };
}
