import type { FC } from "react";
import React from "react";
import type {
  DeepbookPoolRegisteredEventResponse,
  DeepbookPoolConfigUpdatedEventResponse,
} from "../api/events";
import { fetchLatestDeepbookPoolConfig } from "../api/events";
import { useAppNetwork } from "../../../context/AppNetworkContext";

// Tooltip component for info icons
const InfoTooltip: FC<{ tooltip: string }> = ({ tooltip }) => {
  const [show, setShow] = React.useState(false);
  
  return (
    <div className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-3 h-3 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[8px] text-white/50 hover:text-white/70 transition-all cursor-help"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1.5 text-[10px] text-white/90 bg-slate-900 border border-white/20 rounded-lg shadow-xl w-48 leading-relaxed pointer-events-none">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-white/20" />
        </div>
      )}
    </div>
  );
};

// Tooltip definitions for each ratio
const TOOLTIPS = {
  borrowRiskRatio: "Minimum collateral ratio required to borrow. Your position must maintain at least this ratio of assets to debt to take new loans.",
  liquidationRiskRatio: "Threshold below which your position can be liquidated. If your collateral ratio falls below this, liquidators can close your position.",
  withdrawRiskRatio: "Minimum ratio required to withdraw collateral. You cannot withdraw if it would push your position below this threshold.",
  targetLiqRisk: "Target ratio after partial liquidation. When liquidated, the system aims to restore your position to this healthier ratio.",
  poolReward: "Percentage of liquidation amount given to the lending pool as compensation for absorbed risk.",
  userReward: "Percentage of liquidation amount given to the liquidator as incentive for maintaining system health.",
  marginDisabled: "Margin trading is disabled for this pool. Trading and borrowing features are not available until enabled by pool administrators.",
  marginEnabled: "Margin trading is active. You can open leveraged positions and borrow against your collateral in this pool.",
};

interface Props {
  poolIds: string[];
  linkedMarginPools?: string[];  // e.g., ["SUI", "DBUSDC"]
  onHistoryClick?: (poolId: string) => void;
}

type PoolConfig =
  | DeepbookPoolRegisteredEventResponse
  | DeepbookPoolConfigUpdatedEventResponse
  | null;

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRiskRatio(value: number): string {
  // Risk ratios are in 9-decimal format (like config values)
  // Display as multiplier (e.g., 2x, 1.25x) instead of percentage
  const multiplier = value / 1_000_000_000;
  return multiplier.toFixed(2) + "x";
}

function formatRewardPercent(value: number): string {
  // Reward percentages are in 9-decimal format
  // Display as percentage (e.g., 3%, 2%)
  return ((value / 1_000_000_000) * 100).toFixed(2) + "%";
}

export const DeepBookPoolCard: FC<Props> = ({ poolIds, linkedMarginPools = ["SUI", "DBUSDC"], onHistoryClick }) => {
  const { explorerUrl, serverUrl } = useAppNetwork();
  const [poolConfigs, setPoolConfigs] = React.useState<
    Record<string, PoolConfig>
  >({});
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch all pool configs - refetch when poolIds or serverUrl changes
  React.useEffect(() => {
    async function fetchConfigs() {
      setIsLoading(true);
      const configs: Record<string, PoolConfig> = {};

      await Promise.all(
        poolIds.map(async (poolId) => {
          try {
            const config = await fetchLatestDeepbookPoolConfig(poolId);
            configs[poolId] = config;
          } catch (error) {
            console.error(`Error fetching config for pool ${poolId}:`, error);
            configs[poolId] = null;
          }
        })
      );

      setPoolConfigs(configs);
      setIsLoading(false);
    }

    if (poolIds.length > 0) {
      fetchConfigs();
    } else {
      setIsLoading(false);
    }
  }, [poolIds, serverUrl]);

  if (isLoading) {
    return (
      <div className="relative rounded-2xl p-5 border bg-white/5 border-white/10 animate-pulse h-full">
        <div className="space-y-4">
          <div className="h-6 w-32 bg-white/10 rounded" />
          <div className="h-4 w-full bg-white/10 rounded" />
          <div className="h-4 w-3/4 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (poolIds.length === 0) {
    return (
      <div className="relative rounded-2xl p-5 border bg-white/5 border-white/10 h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-white/50">
            No linked trading pools
          </p>
        </div>
      </div>
    );
  }

  // Use the first pool's configuration (all pools in a trading pair share the same config)
  const currentPoolId = poolIds[0];
  const currentConfig = poolConfigs[currentPoolId];

  if (!currentConfig || !currentConfig.config_json) {
    return (
      <div className="relative rounded-2xl p-5 border bg-white/5 border-white/10 h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-400">
            Error loading pool configuration
          </p>
          <p className="text-xs text-white/50 mt-2">
            Pool ID: {formatAddress(currentPoolId)}
          </p>
        </div>
      </div>
    );
  }

  const config = currentConfig.config_json;
  const enabled = config?.enabled ?? false;

  return (
    <div className="relative rounded-2xl p-5 border bg-white/5 border-white/10 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {linkedMarginPools.join("/")} Trading Pool
          </h3>
          {/* Linked Margin Pools */}
          <p className="text-xs text-white/50 mt-1">
            Linked Margin Pools: <span className="text-cyan-400 font-medium">{linkedMarginPools.join(", ")}</span>
          </p>
        </div>
        <div className="flex items-center">
          <div
            className={`px-2 py-1 rounded-lg text-xs font-semibold ${
              enabled
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-red-500/20 text-red-300"
            }`}
          >
            {enabled ? "Margin Enabled" : "Margin Disabled"}
          </div>
          <InfoTooltip tooltip={enabled ? TOOLTIPS.marginEnabled : TOOLTIPS.marginDisabled} />
        </div>
      </div>

      {/* Pool ID - Inline compact */}
      <div className="flex items-center gap-1.5 mb-3 text-xs text-white/50">
        <span>Pool</span>
        <a
          href={`${explorerUrl}/object/${currentPoolId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
        >
          {formatAddress(currentPoolId)}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Risk Ratios */}
      <div className="space-y-3 flex-1">
        <div className="text-xs text-white/50 font-semibold mb-2">
          Risk Ratios
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-lg p-2 border border-white/5">
            <div className="text-[10px] text-white/40 mb-1 flex items-center">
              Borrow Risk Ratio
              <InfoTooltip tooltip={TOOLTIPS.borrowRiskRatio} />
            </div>
            <div className="text-xs font-semibold text-white">
              {config?.risk_ratios?.min_borrow_risk_ratio
                ? formatRiskRatio(config.risk_ratios.min_borrow_risk_ratio)
                : "N/A"}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-2 border border-white/5">
            <div className="text-[10px] text-white/40 mb-1 flex items-center">
              Liq. Risk Ratio
              <InfoTooltip tooltip={TOOLTIPS.liquidationRiskRatio} />
            </div>
            <div className="text-xs font-semibold text-teal-400">
              {config?.risk_ratios?.liquidation_risk_ratio
                ? formatRiskRatio(config.risk_ratios.liquidation_risk_ratio)
                : "N/A"}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-2 border border-white/5">
            <div className="text-[10px] text-white/40 mb-1 flex items-center">
              Withdraw Risk Ratio
              <InfoTooltip tooltip={TOOLTIPS.withdrawRiskRatio} />
            </div>
            <div className="text-xs font-semibold text-white">
              {config?.risk_ratios?.min_withdraw_risk_ratio
                ? formatRiskRatio(config.risk_ratios.min_withdraw_risk_ratio)
                : "N/A"}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-2 border border-white/5">
            <div className="text-[10px] text-white/40 mb-1 flex items-center">
              Target Liq. Risk
              <InfoTooltip tooltip={TOOLTIPS.targetLiqRisk} />
            </div>
            <div className="text-xs font-semibold text-emerald-400">
              {config?.risk_ratios?.target_liquidation_risk_ratio
                ? formatRiskRatio(
                    config.risk_ratios.target_liquidation_risk_ratio
                  )
                : "N/A"}
            </div>
          </div>
        </div>

        {/* Liquidation Rewards */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="bg-white/5 rounded-lg p-2 border border-white/5">
            <div className="text-[10px] text-white/40 mb-1 flex items-center">
              Pool Reward
              <InfoTooltip tooltip={TOOLTIPS.poolReward} />
            </div>
            <div className="text-xs font-semibold text-cyan-400">
              {config?.pool_liquidation_reward
                ? formatRewardPercent(config.pool_liquidation_reward)
                : "N/A"}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-2 border border-white/5">
            <div className="text-[10px] text-white/40 mb-1 flex items-center">
              User Reward
              <InfoTooltip tooltip={TOOLTIPS.userReward} />
            </div>
            <div className="text-xs font-semibold text-cyan-400">
              {config?.user_liquidation_reward
                ? formatRewardPercent(config.user_liquidation_reward)
                : "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* History Button */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <button
          onClick={() => onHistoryClick?.(currentPoolId)}
          className="w-full px-3 py-2.5 rounded-lg text-xs font-semibold transition-all bg-teal-400 text-slate-900 hover:bg-amber-300"
        >
          View Config History
        </button>
      </div>
    </div>
  );
};

export default DeepBookPoolCard;
