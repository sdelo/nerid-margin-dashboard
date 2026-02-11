import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSuiClient } from '@mysten/dapp-kit';
import {
  fetchSupplyReferralMinted,
  fetchReferralFeesClaimed,
  fetchProtocolFeesIncreased,
} from '../api/events';
import { fetchMultipleReferralTrackers, type ReferralTrackerData } from '../../../api/onChainReads';
import { useAppNetwork } from '../../../context/AppNetworkContext';
import { getContracts } from '../../../config/contracts';
import type { PoolOverview } from '../types';

/**
 * Aggregated referral data combining events with computed stats
 */
export interface ReferralInfo {
  referralId: string;
  marginPoolId: string;
  owner: string;
  createdAt: number;
  txDigest: string;
  // Computed from claims
  totalClaimed: bigint;
  claimCount: number;
  lastClaimAt: number | null;
  // On-chain data (live)
  currentShares: bigint | null;
  unclaimedFees: bigint | null;
  sharePercent: number | null;
}

/**
 * Fee claim event with formatted data
 */
export interface ReferralClaim {
  referralId: string;
  owner: string;
  fees: bigint;
  timestamp: number;
  txDigest: string;
}

/**
 * Protocol fee distribution event
 */
export interface FeeDistribution {
  marginPoolId: string;
  totalShares: bigint;
  referralFees: bigint;
  maintainerFees: bigint;
  protocolFees: bigint;
  timestamp: number;
  txDigest: string;
}

/**
 * Aggregated stats for a pool's referral system
 */
export interface PoolReferralStats {
  totalReferrals: number;
  totalClaimedFees: bigint;
  totalDistributedReferralFees: bigint;
  recentDistributions: FeeDistribution[];
}

export interface ReferralActivityResult {
  // All referrals in the system
  referrals: ReferralInfo[];
  // All claim events
  claims: ReferralClaim[];
  // Fee distribution history
  feeDistributions: FeeDistribution[];
  // Aggregated pool stats
  poolStats: PoolReferralStats;
  // Loading states
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  // Refetch
  refetch: () => void;
}

/**
 * Hook to fetch all referral activity for a margin pool
 * 
 * @param pool - The pool to fetch referral activity for
 * @returns Referral activity data including all referrals, claims, and fee distributions
 */
export function useReferralActivity(pool: PoolOverview | null): ReferralActivityResult {
  const suiClient = useSuiClient();
  const { network } = useAppNetwork();
  const contracts = getContracts(network as 'mainnet' | 'testnet');
  
  const poolId = pool?.id;
  const assetType = pool?.contracts?.coinType;
  const packageId = contracts.MARGIN_PACKAGE_ID;
  
  // Fetch all referrals minted for this pool
  const referralsMintedQuery = useQuery({
    queryKey: ['supplyReferralMinted', poolId],
    queryFn: () => fetchSupplyReferralMinted({ margin_pool_id: poolId, limit: 1000 }),
    enabled: !!poolId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all fee claims for this pool
  const claimsQuery = useQuery({
    queryKey: ['referralFeesClaimed', poolId],
    queryFn: () => fetchReferralFeesClaimed({ margin_pool_id: poolId, limit: 1000 }),
    enabled: !!poolId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch fee distribution events
  const feeDistributionsQuery = useQuery({
    queryKey: ['protocolFeesIncreased', poolId],
    queryFn: () => fetchProtocolFeesIncreased({ margin_pool_id: poolId, limit: 500 }),
    enabled: !!poolId,
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  // Get referral IDs from minted events
  const referralIds = React.useMemo(() => 
    (referralsMintedQuery.data ?? []).map(r => r.supply_referral_id),
    [referralsMintedQuery.data]
  );

  // Defer on-chain referral fetch so it doesn't compete with critical initial data
  // (pool data, vault balances, etc.). The referral section is at the bottom of the
  // page and doesn't need to load instantly.
  const [deferredReady, setDeferredReady] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setDeferredReady(true), 3_000); // 3s after mount
    return () => clearTimeout(timer);
  }, []);

  // Fetch on-chain referral tracker data for each referral
  const onChainDataQuery = useQuery({
    queryKey: ['referralTrackers', poolId, packageId, referralIds.join(',')],
    queryFn: async () => {
      if (!poolId || !assetType || referralIds.length === 0) {
        return new Map<string, ReferralTrackerData>();
      }
      const result = await fetchMultipleReferralTrackers(suiClient, poolId, referralIds, assetType, packageId);
      return result;
    },
    enabled: deferredReady && !!poolId && !!assetType && referralIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes (this data changes rarely)
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes (was 1 min)
  });

  // Transform and aggregate the data
  const result = React.useMemo(() => {
    const referralsMinted = referralsMintedQuery.data ?? [];
    const claimsRaw = claimsQuery.data ?? [];
    const distributionsRaw = feeDistributionsQuery.data ?? [];
    const onChainData = onChainDataQuery.data ?? new Map();

    // Build claims lookup by referral ID for aggregation
    const claimsByReferral = new Map<string, { totalClaimed: bigint; count: number; lastClaimAt: number | null }>();
    
    const claims: ReferralClaim[] = claimsRaw.map((claim) => {
      const fees = BigInt(claim.fees || '0');
      
      // Aggregate claims per referral
      const existing = claimsByReferral.get(claim.referral_id) || { totalClaimed: 0n, count: 0, lastClaimAt: null };
      claimsByReferral.set(claim.referral_id, {
        totalClaimed: existing.totalClaimed + fees,
        count: existing.count + 1,
        lastClaimAt: Math.max(existing.lastClaimAt || 0, claim.onchain_timestamp),
      });
      
      return {
        referralId: claim.referral_id,
        owner: claim.owner,
        fees,
        timestamp: claim.onchain_timestamp,
        txDigest: claim.digest,
      };
    });

    // Calculate total shares for percentage calculation
    let totalShares = 0n;
    onChainData.forEach((data) => {
      totalShares += data.currentShares;
    });

    // Build referral info with aggregated claim data and on-chain data
    const referrals: ReferralInfo[] = referralsMinted.map((ref) => {
      const claimStats = claimsByReferral.get(ref.supply_referral_id) || { 
        totalClaimed: 0n, 
        count: 0, 
        lastClaimAt: null 
      };
      
      const trackerData = onChainData.get(ref.supply_referral_id);
      const currentShares = trackerData?.currentShares ?? null;
      const unclaimedFees = trackerData?.unclaimedFees ?? null;
      const sharePercent = currentShares !== null && totalShares > 0n
        ? Number((currentShares * 10000n) / totalShares) / 100 // Percentage with 2 decimals
        : null;
      
      return {
        referralId: ref.supply_referral_id,
        marginPoolId: ref.margin_pool_id,
        owner: ref.owner,
        createdAt: ref.onchain_timestamp,
        txDigest: ref.digest,
        totalClaimed: claimStats.totalClaimed,
        claimCount: claimStats.count,
        lastClaimAt: claimStats.lastClaimAt,
        currentShares,
        unclaimedFees,
        sharePercent,
      };
    });

    // Sort referrals by share percentage (highest first)
    referrals.sort((a, b) => {
      if (a.sharePercent === null && b.sharePercent === null) return 0;
      if (a.sharePercent === null) return 1;
      if (b.sharePercent === null) return -1;
      return b.sharePercent - a.sharePercent;
    });

    // Process fee distributions
    const feeDistributions: FeeDistribution[] = distributionsRaw.map((dist) => ({
      marginPoolId: dist.margin_pool_id,
      totalShares: BigInt(dist.total_shares || '0'),
      referralFees: BigInt(dist.referral_fees || '0'),
      maintainerFees: BigInt(dist.maintainer_fees || '0'),
      protocolFees: BigInt(dist.protocol_fees || '0'),
      timestamp: dist.onchain_timestamp,
      txDigest: dist.digest,
    }));

    // Calculate pool-wide stats
    const totalClaimedFees = claims.reduce((sum, c) => sum + c.fees, 0n);
    const totalDistributedReferralFees = feeDistributions.reduce((sum, d) => sum + d.referralFees, 0n);

    const poolStats: PoolReferralStats = {
      totalReferrals: referrals.length,
      totalClaimedFees,
      totalDistributedReferralFees,
      recentDistributions: feeDistributions.slice(0, 10), // Most recent 10
    };

    return {
      referrals,
      claims,
      feeDistributions,
      poolStats,
    };
  }, [referralsMintedQuery.data, claimsQuery.data, feeDistributionsQuery.data, onChainDataQuery.data]);

  const isLoading = referralsMintedQuery.isLoading || claimsQuery.isLoading || feeDistributionsQuery.isLoading;
  const isError = referralsMintedQuery.isError || claimsQuery.isError || feeDistributionsQuery.isError;
  const error = referralsMintedQuery.error || claimsQuery.error || feeDistributionsQuery.error;

  const refetch = React.useCallback(() => {
    referralsMintedQuery.refetch();
    claimsQuery.refetch();
    feeDistributionsQuery.refetch();
    onChainDataQuery.refetch();
  }, [referralsMintedQuery, claimsQuery, feeDistributionsQuery, onChainDataQuery]);

  return {
    ...result,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
