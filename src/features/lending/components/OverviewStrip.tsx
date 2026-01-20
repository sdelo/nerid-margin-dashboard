import type { FC } from "react";
import type { PoolOverview } from "../types";
import { utilizationPct } from "../../../utils/format";

type Props = { pool: PoolOverview };

export const OverviewStrip: FC<Props> = ({ pool }) => {
  const util = utilizationPct(pool.state.supply, pool.state.borrow);
  return (
    <div
      className="rounded-2xl p-5 bg-white/10 border"
      style={{
        borderColor:
          "color-mix(in oklab, var(--color-cyan-300) 40%, transparent)",
      }}
    >
      <h3 className="text-lg font-semibold text-cyan-200 mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_2px_rgba(34,211,238,0.6)]"></span>
        Pool Overview
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-cyan-100/70">Total Supply</p>
          <p className="text-lg font-bold text-teal-300">
            {Number(pool.state.supply).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-cyan-100/70">Total Borrow</p>
          <p className="text-lg font-bold text-teal-300">
            {Number(pool.state.borrow).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-cyan-100/70">Utilization</p>
          <p className="text-lg font-bold text-teal-300">{util}%</p>
        </div>
      </div>
    </div>
  );
};

export default OverviewStrip;
