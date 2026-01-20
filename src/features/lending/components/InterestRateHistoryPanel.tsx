import React from "react";
import { ClockIcon } from "@heroicons/react/24/outline";
import { useInterestRateHistory } from "../hooks/useEvents";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { PoolOverview } from "../types";
import { useChartFirstRender } from "../../../components/charts/StableChart";

interface InterestRateHistoryPanelProps {
  poolId?: string;
  poolName?: string;
  onClose: () => void;
  currentPool?: PoolOverview; // Current on-chain pool data for comparison
}

export function InterestRateHistoryPanel({
  poolId,
  poolName,
  onClose,
  currentPool,
}: InterestRateHistoryPanelProps) {
  const { data: events, isLoading, error } = useInterestRateHistory(poolId);
  const [selectedConfig, setSelectedConfig] = React.useState<any>(null);

  // Filter events with valid interest_config or config_json
  const validEvents = React.useMemo(
    () => events.filter((event) => event.config_json || event.interest_config),
    [events]
  );

  // Convert 9-decimal values to percentages and decimal format
  const formatPercent = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return ((num / 1e9) * 100).toFixed(2);
  };

  const toDecimal = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return num / 1e9;
  };

  // Generate yield curve data for a given config
  const generateCurveData = (config: any) => {
    const baseRate = toDecimal(config.base_rate);
    const baseSlope = toDecimal(config.base_slope);
    const optimalU = toDecimal(config.optimal_utilization);
    const excessSlope = toDecimal(config.excess_slope);

    const steps = 20;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const u = i / steps;
      const apr =
        u <= optimalU
          ? baseRate + baseSlope * u
          : baseRate + baseSlope * optimalU + excessSlope * (u - optimalU);
      return {
        utilization: Math.round(u * 100),
        apr: apr * 100, // Convert to percentage
        optimalU: optimalU * 100,
      };
    });
  };

  // Get current config from on-chain pool data
  const currentConfig = currentPool?.protocolConfig?.interest_config;

  // Display current config or selected historical config
  const displayConfig =
    selectedConfig ||
    (currentConfig && {
      base_rate: currentConfig.base_rate * 1e9,
      base_slope: currentConfig.base_slope * 1e9,
      optimal_utilization: currentConfig.optimal_utilization * 1e9,
      excess_slope: currentConfig.excess_slope * 1e9,
      isCurrent: true,
    });

  const curveData = displayConfig ? generateCurveData(displayConfig) : null;

  // Stable chart rendering - prevent flicker on data updates
  const { animationProps } = useChartFirstRender(!!curveData && curveData.length > 0);

  return (
    <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #0c1a24 0%, #0a1419 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-cyan-500/20">
        <div>
          <h2 className="text-base md:text-lg font-bold text-cyan-100">
            Interest Rate Parameter History
          </h2>
          {poolName && (
            <p className="text-xs text-cyan-200/60 mt-0.5">Pool: {poolName}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Top half - Historical Events List (Scrollable) */}
        <div className="flex-1 overflow-auto p-3 md:p-4 border-b border-cyan-500/20 max-h-[50vh]">
          {isLoading && (
            <div className="flex items-center justify-center h-48">
              <div className="text-cyan-100 text-sm">Loading history...</div>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
              <p className="text-rose-400 text-sm">
                Error loading history: {error.message}
              </p>
            </div>
          )}

          {!isLoading && !error && validEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <ClockIcon className="w-10 h-10 text-cyan-400/30 mb-2" />
              <p className="text-cyan-100 text-sm font-semibold">
                No Parameter Updates Yet
              </p>
              <p className="text-cyan-200/50 text-xs mt-1 max-w-md">
                This pool is using its initial interest rate configuration.
              </p>
            </div>
          )}

          {!isLoading && !error && (
            <div className="space-y-2.5">
              {/* Current Configuration Card (from on-chain data) */}
              {currentConfig && (
                <div
                  onClick={() =>
                    setSelectedConfig({
                      base_rate: currentConfig.base_rate * 1e9,
                      base_slope: currentConfig.base_slope * 1e9,
                      optimal_utilization:
                        currentConfig.optimal_utilization * 1e9,
                      excess_slope: currentConfig.excess_slope * 1e9,
                      isCurrent: true,
                    })
                  }
                  className={`relative rounded-lg border p-3 transition-all cursor-pointer ${
                    selectedConfig?.isCurrent || !selectedConfig
                      ? "bg-emerald-500/10 border-emerald-400/40"
                      : "bg-cyan-900/20 border-cyan-500/20 hover:bg-cyan-900/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-emerald-400 text-xs">
                          Current Configuration
                        </div>
                        <div className="text-[10px] text-white/50">
                          Active on-chain parameters
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                      ACTIVE
                    </span>
                  </div>

                  {/* Parameters Grid */}
                  <div className="bg-cyan-900/20 rounded p-2 border border-cyan-500/10">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-cyan-200/40">
                          Base Rate
                        </div>
                        <div className="text-sm font-bold text-cyan-100">
                          {(currentConfig.base_rate * 100).toFixed(2)}%
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-cyan-200/40">
                          Base Slope
                        </div>
                        <div className="text-sm font-bold text-cyan-100">
                          {(currentConfig.base_slope * 100).toFixed(2)}%
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-cyan-200/40">
                          Optimal Utilization
                        </div>
                        <div className="text-sm font-bold text-cyan-100">
                          {(currentConfig.optimal_utilization * 100).toFixed(2)}%
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-cyan-200/40">
                          Excess Slope
                        </div>
                        <div className="text-sm font-bold text-cyan-100">
                          {(currentConfig.excess_slope * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Events */}
              {validEvents.length > 0 && (
                <>
                  <div className="text-[10px] text-cyan-200/40 uppercase tracking-wider font-semibold pt-1.5">
                    Historical Updates
                  </div>
                  {validEvents.map((event, index) => {
                    // Use config_json as primary field, fall back to interest_config
                    const config = event.config_json || event.interest_config!;
                    const isSelected =
                      selectedConfig &&
                      !selectedConfig.isCurrent &&
                      selectedConfig.timestamp ===
                        event.checkpoint_timestamp_ms;

                    return (
                      <div
                        key={event.event_digest}
                        onClick={() =>
                          setSelectedConfig({
                            ...config,
                            timestamp: event.checkpoint_timestamp_ms,
                            isCurrent: false,
                          })
                        }
                        className={`relative rounded-lg border p-3 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/10 border-teal-400/40"
                            : "bg-cyan-900/20 border-cyan-500/20 hover:bg-cyan-900/30"
                        }`}
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-1 top-4 w-2 h-2 rounded-full bg-cyan-400 border-2 border-[#0c1a24]" />

                        {/* Timestamp */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
                              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                            <div>
                              <div
                                className={`font-semibold text-xs ${isSelected ? "text-teal-400" : "text-cyan-400"}`}
                              >
                                Interest Rate Update
                              </div>
                              <div className="text-[10px] text-white/50">
                                {new Date(
                                  event.checkpoint_timestamp_ms
                                ).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                •{" "}
                                {(() => {
                                  const diff =
                                    Date.now() - event.checkpoint_timestamp_ms;
                                  const days = Math.floor(
                                    diff / (1000 * 60 * 60 * 24)
                                  );
                                  if (days > 0)
                                  return `${days}d ago`;
                                const hours = Math.floor(
                                  diff / (1000 * 60 * 60)
                                );
                                if (hours > 0)
                                  return `${hours}h ago`;
                                return "Just now";
                              })()}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-cyan-200/40">
                          {new Date(
                            event.checkpoint_timestamp_ms
                          ).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Parameters Grid */}
                      <div className="ml-0 md:ml-8 bg-cyan-900/20 rounded p-2 border border-cyan-500/10">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] text-cyan-200/40">
                              Base Rate
                            </div>
                            <div className="text-sm font-bold text-cyan-100">
                              {formatPercent(config.base_rate)}%
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] text-cyan-200/40">
                              Base Slope
                            </div>
                            <div className="text-sm font-bold text-cyan-100">
                              {formatPercent(config.base_slope)}%
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] text-cyan-200/40">
                              Optimal Util
                            </div>
                            <div className="text-sm font-bold text-cyan-100">
                              {formatPercent(config.optimal_utilization)}%
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] text-cyan-200/40">
                              Excess Slope
                            </div>
                            <div className="text-sm font-bold text-cyan-100">
                              {formatPercent(config.excess_slope)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="ml-0 md:ml-8 mt-1">
                        <div className="text-[9px] text-cyan-200/40">
                          Checkpoint: {event.checkpoint.toLocaleString()} • {event.event_digest.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom half - Yield Curve Visualization */}
        <div className="p-3 md:p-4 bg-[#081114]/50 overflow-auto">
          <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm md:text-base font-bold text-cyan-100 mb-0.5">
                  {displayConfig?.isCurrent ? "Current" : "Historical"} Yield Curve
                </h3>
                <p className="text-cyan-200/50 text-xs">
                  Interest rate vs utilization
                </p>
              </div>
              <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          {curveData && (
            <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-3 md:p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={curveData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                  />
                  <XAxis
                    dataKey="utilization"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                    label={{
                      value: "Utilization %",
                      position: "insideBottom",
                      offset: -10,
                      fill: "rgba(255,255,255,0.7)",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    dataKey="apr"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                    label={{
                      value: "Borrow APR %",
                      angle: -90,
                      position: "insideLeft",
                      fill: "rgba(255,255,255,0.7)",
                      fontSize: 12,
                    }}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.9)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [
                      `${value.toFixed(2)}%`,
                      "Borrow APR",
                    ]}
                    labelFormatter={(label) => `Utilization: ${label}%`}
                  />
                  <ReferenceLine
                    x={curveData[0].optimalU}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{
                      value: "Optimal",
                      position: "top",
                      fill: "#f59e0b",
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="apr"
                    stroke={displayConfig?.isCurrent ? "#10b981" : "#f59e0b"}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                    {...animationProps}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 text-xs">
                <div className="bg-cyan-900/30 rounded p-1.5 md:p-2 border border-cyan-500/10">
                  <div className="text-cyan-200/40 text-[10px] mb-0.5">Base Rate</div>
                  <div className="text-cyan-100 font-bold text-xs md:text-sm">
                    {formatPercent(displayConfig.base_rate)}%
                  </div>
                </div>
                <div className="bg-cyan-900/30 rounded p-1.5 md:p-2 border border-cyan-500/10">
                  <div className="text-cyan-200/40 text-[10px] mb-0.5">Base Slope</div>
                  <div className="text-cyan-100 font-bold text-xs md:text-sm">
                    {formatPercent(displayConfig.base_slope)}%
                  </div>
                </div>
                <div className="bg-cyan-900/30 rounded p-1.5 md:p-2 border border-cyan-500/10">
                  <div className="text-cyan-200/40 text-[10px] mb-0.5">Optimal Util</div>
                  <div className="text-cyan-100 font-bold text-xs md:text-sm">
                    {formatPercent(displayConfig.optimal_utilization)}%
                  </div>
                </div>
                <div className="bg-cyan-900/30 rounded p-1.5 md:p-2 border border-cyan-500/10">
                  <div className="text-cyan-200/40 text-[10px] mb-0.5">Excess Slope</div>
                  <div className="text-cyan-100 font-bold text-xs md:text-sm">
                    {formatPercent(displayConfig.excess_slope)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {!curveData && (
            <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-8 text-center">
              <p className="text-sm text-cyan-100/50 mb-1">
                Select a configuration to view its yield curve
              </p>
              <p className="text-xs text-cyan-200/30">
                Click on any configuration card above
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
