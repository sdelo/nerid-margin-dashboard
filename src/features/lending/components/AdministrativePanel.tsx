import React from 'react';
import {
  fetchMaintainerFeesWithdrawn,
  fetchProtocolFeesWithdrawn,
  fetchInterestParamsUpdated,
  fetchMarginPoolConfigUpdated,
  fetchDeepbookPoolUpdated,
  type MaintainerFeesWithdrawnEventResponse,
  type ProtocolFeesWithdrawnEventResponse,
  type InterestParamsUpdatedEventResponse,
  type MarginPoolConfigUpdatedEventResponse,
  type DeepbookPoolUpdatedEventResponse,
} from '../api/events';
import { type TimeRange, timeRangeToParams } from '../api/types';
import TimeRangeSelector from '../../../components/TimeRangeSelector';

export function AdministrativePanel({ poolId }: { poolId?: string }) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>('ALL');
  const [maintainerFees, setMaintainerFees] = React.useState<MaintainerFeesWithdrawnEventResponse[]>([]);
  const [protocolFees, setProtocolFees] = React.useState<ProtocolFeesWithdrawnEventResponse[]>([]);
  const [interestUpdates, setInterestUpdates] = React.useState<InterestParamsUpdatedEventResponse[]>([]);
  const [configUpdates, setConfigUpdates] = React.useState<MarginPoolConfigUpdatedEventResponse[]>([]);
  const [poolUpdates, setPoolUpdates] = React.useState<DeepbookPoolUpdatedEventResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Fetch all administrative events
  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const params = {
          ...timeRangeToParams(timeRange),
          ...(poolId && { margin_pool_id: poolId }),
          limit: 1000,
        };

        const [maintainer, protocol, interest, config, poolUpd] = await Promise.all([
          fetchMaintainerFeesWithdrawn(params),
          fetchProtocolFeesWithdrawn(params),
          fetchInterestParamsUpdated(params),
          fetchMarginPoolConfigUpdated(params),
          fetchDeepbookPoolUpdated(params),
        ]);

        setMaintainerFees(maintainer);
        setProtocolFees(protocol);
        setInterestUpdates(interest);
        setConfigUpdates(config);
        setPoolUpdates(poolUpd);
        setError(null);
      } catch (err) {
        console.error('Error fetching administrative data:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [timeRange, poolId]);

  // Calculate summary metrics
  const summary = React.useMemo(() => {
    const totalMaintainerFees = maintainerFees.reduce(
      (sum, event) => {
        const amount = parseFloat(event.maintainer_fees || '0');
        return sum + (isNaN(amount) ? 0 : amount);
      },
      0
    );
    const totalProtocolFees = protocolFees.reduce(
      (sum, event) => {
        const amount = parseFloat(event.protocol_fees || '0');
        return sum + (isNaN(amount) ? 0 : amount);
      },
      0
    );

    return {
      totalMaintainerFees: totalMaintainerFees / 1e9,
      totalProtocolFees: totalProtocolFees / 1e9,
      totalInterestUpdates: interestUpdates.length,
      totalConfigUpdates: configUpdates.length,
      totalPoolUpdates: poolUpdates.length,
    };
  }, [maintainerFees, protocolFees, interestUpdates, configUpdates, poolUpdates]);

  if (error) {
    return (
      <div className="card-surface p-6 rounded-3xl border border-red-500/20">
        <p className="text-red-400">Error loading administrative data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-purple-200">Administrative Actions</h2>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <div className="card-surface p-3 rounded-xl border border-white/10">
          <div className="text-lg mb-1">💰</div>
          <div className="text-base font-bold text-white mb-0.5">
            {isLoading ? (
              <div className="h-5 w-14 bg-white/10 rounded animate-pulse"></div>
            ) : (
              summary.totalMaintainerFees.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })
            )}
          </div>
          <div className="text-[10px] text-white/60">Maintainer Fees</div>
        </div>

        <div className="card-surface p-3 rounded-xl border border-white/10">
          <div className="text-lg mb-1">🏛️</div>
          <div className="text-base font-bold text-white mb-0.5">
            {isLoading ? (
              <div className="h-5 w-14 bg-white/10 rounded animate-pulse"></div>
            ) : (
              summary.totalProtocolFees.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })
            )}
          </div>
          <div className="text-[10px] text-white/60">Protocol Fees</div>
        </div>

        <div className="card-surface p-3 rounded-xl border border-white/10">
          <div className="text-lg mb-1">📊</div>
          <div className="text-base font-bold text-white mb-0.5">
            {isLoading ? (
              <div className="h-5 w-10 bg-white/10 rounded animate-pulse"></div>
            ) : (
              summary.totalInterestUpdates
            )}
          </div>
          <div className="text-[10px] text-white/60">Interest Updates</div>
        </div>

        <div className="card-surface p-3 rounded-xl border border-white/10">
          <div className="text-lg mb-1">⚙️</div>
          <div className="text-base font-bold text-white mb-0.5">
            {isLoading ? (
              <div className="h-5 w-10 bg-white/10 rounded animate-pulse"></div>
            ) : (
              summary.totalConfigUpdates
            )}
          </div>
          <div className="text-[10px] text-white/60">Config Updates</div>
        </div>

        <div className="card-surface p-3 rounded-xl border border-white/10">
          <div className="text-lg mb-1">🔗</div>
          <div className="text-base font-bold text-white mb-0.5">
            {isLoading ? (
              <div className="h-5 w-10 bg-white/10 rounded animate-pulse"></div>
            ) : (
              summary.totalPoolUpdates
            )}
          </div>
          <div className="text-[10px] text-white/60">Pool Updates</div>
        </div>
      </div>

      {/* Fee Withdrawals */}
      <div className="card-surface p-4 rounded-xl border border-white/10">
        <h3 className="text-sm font-bold text-purple-200 mb-3">Fee Withdrawal History</h3>
        
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-white/5 rounded animate-pulse"></div>
            ))}
          </div>
        ) : maintainerFees.length === 0 && protocolFees.length === 0 ? (
          <div className="text-center py-6 text-white/60">
            <div className="text-2xl mb-1">📭</div>
            <p className="text-xs">No fee withdrawals in the selected time range</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {[
              ...maintainerFees.map(e => ({ ...e, type: 'Maintainer' as const })),
              ...protocolFees.map(e => ({ ...e, type: 'Protocol' as const })),
            ]
              .sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms)
              .slice(0, 50)
              .map((event, index) => (
                <div
                  key={index}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    event.type === 'Maintainer'
                      ? 'bg-cyan-500/5 border-cyan-500/20'
                      : 'bg-purple-500/5 border-purple-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        event.type === 'Maintainer'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {event.type}
                      </span>
                      <span className="text-xs text-white font-semibold">
                        {(() => {
                          const amount = parseFloat(
                            event.type === 'Maintainer' 
                              ? (event as any).maintainer_fees || '0'
                              : (event as any).protocol_fees || '0'
                          );
                          const displayAmount = isNaN(amount) ? 0 : amount / 1e9;
                          return displayAmount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          });
                        })()}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/60">
                      {new Date(event.checkpoint_timestamp_ms).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-white/60">
                    Pool: {event.margin_pool_id.slice(0, 8)}...{event.margin_pool_id.slice(-6)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Interest Rate Updates */}
      <div className="card-surface p-4 rounded-xl border border-white/10">
        <h3 className="text-sm font-bold text-purple-200 mb-3">Interest Rate Updates</h3>
        
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded animate-pulse"></div>
            ))}
          </div>
        ) : interestUpdates.length === 0 ? (
          <div className="text-center py-6 text-white/60">
            <div className="text-2xl mb-1">📊</div>
            <p className="text-xs">No interest rate updates in the selected time range</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {interestUpdates
              .sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms)
              .map((event, index) => (
                <div key={index} className="p-2.5 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-cyan-300">Interest Config Updated</span>
                    <span className="text-[10px] text-white/60">
                      {new Date(event.checkpoint_timestamp_ms).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    <div>
                      <div className="text-white/60 mb-0.5">Base Rate</div>
                      <div className="text-white font-semibold text-xs">
                        {(() => {
                          const value = parseFloat(event.interest_config.base_rate || '0');
                          return isNaN(value) ? '0.00%' : `${(value / 1e9 * 100).toFixed(2)}%`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 mb-0.5">Base Slope</div>
                      <div className="text-white font-semibold text-xs">
                        {(() => {
                          const value = parseFloat(event.interest_config.base_slope || '0');
                          return isNaN(value) ? '0.00%' : `${(value / 1e9 * 100).toFixed(2)}%`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 mb-0.5">Optimal Util</div>
                      <div className="text-white font-semibold text-xs">
                        {(() => {
                          const value = parseFloat(event.interest_config.optimal_utilization || '0');
                          return isNaN(value) ? '0.00%' : `${(value / 1e9 * 100).toFixed(2)}%`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 mb-0.5">Excess Slope</div>
                      <div className="text-white font-semibold text-xs">
                        {(() => {
                          const value = parseFloat(event.interest_config.excess_slope || '0');
                          return isNaN(value) ? '0.00%' : `${(value / 1e9 * 100).toFixed(2)}%`;
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-1.5 text-[10px] font-mono text-white/60">
                    Pool: {event.margin_pool_id.slice(0, 8)}...{event.margin_pool_id.slice(-6)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Pool Configuration Updates */}
      <div className="card-surface p-4 rounded-xl border border-white/10">
        <h3 className="text-sm font-bold text-purple-200 mb-3">Pool Configuration Updates</h3>
        
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded animate-pulse"></div>
            ))}
          </div>
        ) : configUpdates.length === 0 ? (
          <div className="text-center py-6 text-white/60">
            <div className="text-2xl mb-1">⚙️</div>
            <p className="text-xs">No configuration updates in the selected time range</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {configUpdates
              .sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms)
              .map((event, index) => (
                <div key={index} className="p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-amber-300">Pool Config Updated</span>
                    <span className="text-[10px] text-white/60">
                      {new Date(event.checkpoint_timestamp_ms).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    <div>
                      <div className="text-white/60 mb-0.5">Supply Cap</div>
                      <div className="text-white font-semibold text-xs">
                        {(() => {
                          const value = parseFloat(event.margin_pool_config.supply_cap || '0');
                          return isNaN(value) ? '0' : (value / 1e9).toLocaleString();
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 mb-0.5">Max Util</div>
                      <div className="text-white font-semibold text-xs">
                        {(() => {
                          const value = parseFloat(event.margin_pool_config.max_utilization_rate || '0');
                          return isNaN(value) ? '0.00%' : `${(value / 1e9 * 100).toFixed(2)}%`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 mb-0.5">Protocol Spread</div>
                      <div className="text-white font-semibold text-xs">
                        {(() => {
                          const value = parseFloat(event.margin_pool_config.protocol_spread || '0');
                          return isNaN(value) ? '0.00%' : `${(value / 1e9 * 100).toFixed(2)}%`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 mb-0.5">Min Borrow</div>
                      <div className="text-white font-semibold text-xs">
                        {(() => {
                          const value = parseFloat(event.margin_pool_config.min_borrow || '0');
                          return isNaN(value) ? '0' : (value / 1e9).toLocaleString();
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-1.5 text-[10px] font-mono text-white/60">
                    Pool: {event.margin_pool_id.slice(0, 8)}...{event.margin_pool_id.slice(-6)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

