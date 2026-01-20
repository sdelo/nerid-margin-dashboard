import type { FC } from "react";
import React from "react";
import type { PoolOverview } from "../types";
import { InfoTooltip } from "../../../components/InfoTooltip";
import { useSuiClient } from "@mysten/dapp-kit";
import { MarginPool } from "../../../contracts/deepbook_margin/deepbook_margin/margin_pool";

function formatNumber(n: number | bigint, decimals: number = 2) {
  const num = Number(n);
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + "K";
  }
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

type Props = {
  pool: PoolOverview | null;
};

export const SnapshotStrip: FC<Props> = ({ pool }) => {
  const suiClient = useSuiClient();
  const [vaultBalance, setVaultBalance] = React.useState<number | null>(null);

  // Fetch vault balance
  React.useEffect(() => {
    async function fetchVaultBalance() {
      if (!pool) return;
      try {
        const response = await suiClient.getObject({
          id: pool.contracts.marginPoolId,
          options: { showBcs: true },
        });

        if (response.data?.bcs?.dataType === "moveObject") {
          const marginPool = MarginPool.fromBase64(response.data.bcs.bcsBytes);
          const value =
            Number(marginPool.vault.value) / 10 ** pool.contracts.coinDecimals;
          setVaultBalance(value);
        }
      } catch (error) {
        console.error("Error fetching vault balance:", error);
      }
    }

    fetchVaultBalance();
    const interval = setInterval(fetchVaultBalance, 15000);
    return () => clearInterval(interval);
  }, [pool, suiClient]);

  if (!pool) {
    return (
      <div className="h-14 bg-white/[0.02] rounded-xl animate-pulse" />
    );
  }

  const utilizationPct =
    pool.state.supply > 0
      ? (pool.state.borrow / pool.state.supply) * 100
      : 0;
  const available = vaultBalance ?? pool.state.supply - pool.state.borrow;

  // Status badge logic
  const getStatusBadge = () => {
    if (utilizationPct >= 80) {
      return { label: "HIGH UTIL", color: "bg-red-500/12 text-red-400" };
    }
    if (utilizationPct >= 50) {
      return { label: "OPTIMAL", color: "bg-[#2dd4bf]/12 text-[#2dd4bf]" };
    }
    return { label: "LOW UTIL", color: "bg-emerald-500/12 text-emerald-400" };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="flex items-center justify-between gap-2 px-5 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
      {/* APY */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-wider">
            APY
            <InfoTooltip tooltip="supplyAPY" size="sm" />
          </div>
          <div className="text-lg font-semibold text-[#2dd4bf] font-mono">
            {Number(pool.ui.aprSupplyPct).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-white/[0.08]" />

      {/* Supplied */}
      <div className="flex flex-col">
        <div className="text-[10px] text-white/40 uppercase tracking-wider">
          Supplied
        </div>
        <div className="text-sm font-medium text-white font-mono">
          {formatNumber(pool.state.supply)}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-white/[0.08]" />

      {/* Borrowed */}
      <div className="flex flex-col">
        <div className="text-[10px] text-white/40 uppercase tracking-wider">
          Borrowed
        </div>
        <div className="text-sm font-medium text-amber-400 font-mono">
          {formatNumber(pool.state.borrow)}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-white/[0.08]" />

      {/* Available */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-wider">
          Available
          <InfoTooltip tooltip="availableLiquidity" size="sm" />
        </div>
        <div className="text-sm font-medium text-emerald-400 font-mono">
          {formatNumber(available)}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-white/[0.08]" />

      {/* Utilization */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-wider">
          Util
          <InfoTooltip tooltip="utilizationRate" size="sm" />
        </div>
        <div className="text-sm font-medium text-white font-mono">
          {utilizationPct.toFixed(0)}%
        </div>
      </div>

      {/* Status Badge */}
      <div
        className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide ${statusBadge.color}`}
      >
        {statusBadge.label}
      </div>
    </div>
  );
};

export default SnapshotStrip;
