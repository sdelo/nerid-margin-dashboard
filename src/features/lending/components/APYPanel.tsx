import React from "react";
import { APYHistory } from "./APYHistory";
import { YieldCurve } from "./YieldCurve";
import type { PoolOverview } from "../types";

type Tab = "history" | "model";

interface APYPanelProps {
  pool: PoolOverview;
}

/**
 * Tabbed panel combining APY History and Rate Model (Yield Curve) views.
 * APY History is the default tab.
 */
export function APYPanel({ pool }: APYPanelProps) {
  const [activeTab, setActiveTab] = React.useState<Tab>("history");

  return (
    <div className="space-y-6">
      {/* Shared header with tab toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {activeTab === "history" ? "APY History" : "Rate Model"}
          </h2>
          <p className="text-sm text-white/60">
            {activeTab === "history"
              ? `Historical APY trends based on pool utilization for ${pool.asset}`
              : `How interest rates change with utilization for ${pool.asset}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "history"
                ? "bg-emerald-500 text-white"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            APY History
          </button>
          <button
            onClick={() => setActiveTab("model")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "model"
                ? "bg-cyan-500 text-white"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            Rate Model
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "history" ? (
        <APYHistory pool={pool} embedded />
      ) : (
        <YieldCurve pool={pool} embedded />
      )}
    </div>
  );
}
