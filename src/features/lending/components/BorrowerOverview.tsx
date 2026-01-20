import React from 'react';
import { useMarginManagers } from '../../../hooks/useMarginManagers';

export function BorrowerOverview() {
  const { totalManagers, managersPerPool, recentManagers, isLoading, error } = useMarginManagers();

  if (error) {
    return (
      <div className="card-surface p-6 rounded-3xl border border-red-500/20">
        <p className="text-red-400">Error loading borrower data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-surface p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-4xl">📈</span>
            {isLoading && <div className="animate-pulse h-2 w-2 rounded-full bg-cyan-400"></div>}
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {isLoading ? (
              <div className="h-8 w-20 bg-white/10 rounded animate-pulse"></div>
            ) : (
              totalManagers.toLocaleString()
            )}
          </div>
          <div className="text-sm text-white/60">Total Margin Managers</div>
        </div>

        <div className="card-surface p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-4xl">🆕</span>
            {isLoading && <div className="animate-pulse h-2 w-2 rounded-full bg-cyan-400"></div>}
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {isLoading ? (
              <div className="h-8 w-20 bg-white/10 rounded animate-pulse"></div>
            ) : (
              recentManagers.length.toLocaleString()
            )}
          </div>
          <div className="text-sm text-white/60">New Managers (24h)</div>
        </div>

        <div className="card-surface p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-4xl">🎯</span>
            {isLoading && <div className="animate-pulse h-2 w-2 rounded-full bg-cyan-400"></div>}
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {isLoading ? (
              <div className="h-8 w-20 bg-white/10 rounded animate-pulse"></div>
            ) : (
              Object.keys(managersPerPool).length.toLocaleString()
            )}
          </div>
          <div className="text-sm text-white/60">Active Trading Pools</div>
        </div>
      </div>

      {/* Managers per Pool Distribution */}
      <div className="card-surface p-6 rounded-2xl border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">Managers per DeepBook Pool</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(managersPerPool)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([poolId, count]) => {
                const percentage = totalManagers > 0 ? (count / totalManagers) * 100 : 0;
                return (
                  <div key={poolId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/80 font-mono text-xs">
                        {poolId && poolId.length >= 14 ? `${poolId.slice(0, 8)}...${poolId.slice(-6)}` : poolId || 'N/A'}
                      </span>
                      <span className="text-white font-semibold">{count} managers</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Recent Managers (Last 24h) */}
      <div className="card-surface p-6 rounded-2xl border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">Recently Created Managers (24h)</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded animate-pulse"></div>
            ))}
          </div>
        ) : recentManagers.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            <div className="text-4xl mb-2">📭</div>
            <p>No new managers in the last 24 hours</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentManagers.map(manager => (
              <div
                key={manager.id}
                className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono text-cyan-300 mb-1">
                      {manager.id ? `${manager.id.slice(0, 12)}...${manager.id.slice(-8)}` : 'N/A'}
                    </div>
                    <div className="text-xs text-white/60 font-mono">
                      Owner: {manager.owner ? `${manager.owner.slice(0, 8)}...${manager.owner.slice(-6)}` : 'N/A'}
                    </div>
                  </div>
                  <div className="text-xs text-white/60">
                    {manager.creationTimestamp ? new Date(manager.creationTimestamp).toLocaleString() : 'N/A'}
                  </div>
                </div>
                <div className="text-xs text-white/60 font-mono">
                  Pool: {manager.deepbookPoolId ? `${manager.deepbookPoolId.slice(0, 8)}...${manager.deepbookPoolId.slice(-6)}` : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

