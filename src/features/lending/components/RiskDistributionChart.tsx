import React from 'react';
import { type RiskDistributionBucket } from '../../../hooks/useAtRiskPositions';
import { ChartIcon, InsightIcon } from '../../../components/ThemedIcons';

interface RiskDistributionChartProps {
  buckets: RiskDistributionBucket[];
  isLoading?: boolean;
}

/**
 * Format USD value for display
 */
function formatUsd(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Risk Distribution Heatmap/Histogram Component
 */
export function RiskDistributionChart({ buckets, isLoading }: RiskDistributionChartProps) {
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const totalPositions = buckets.reduce((sum, b) => sum + b.count, 0);
  const totalDebtAtRisk = buckets
    .filter(b => b.maxRatio <= 1.20)
    .reduce((sum, b) => sum + b.totalDebtUsd, 0);

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ChartIcon size={22} />
            Risk Distribution
          </h3>
          <p className="text-sm text-white/60 mt-1">
            Position count by risk ratio range
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{totalPositions}</div>
          <div className="text-xs text-white/60">Total Positions</div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-3 border border-rose-500/30">
          <div className="text-2xl font-bold text-rose-400">
            {buckets[0]?.count || 0}
          </div>
          <div className="text-xs text-white/60">Liquidatable</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-amber-500/30">
          <div className="text-2xl font-bold text-teal-400">
            {(buckets[0]?.count || 0) + (buckets[1]?.count || 0)}
          </div>
          <div className="text-xs text-white/60">Critical Zone</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-2xl font-bold text-white">
            {formatUsd(totalDebtAtRisk)}
          </div>
          <div className="text-xs text-white/60">Debt at Risk</div>
        </div>
      </div>

      {/* Histogram */}
      <div className="space-y-3">
        {buckets.map((bucket, index) => {
          const widthPercent = (bucket.count / maxCount) * 100;
          const isAtRisk = bucket.maxRatio <= 1.20;
          
          return (
            <div key={index} className="group">
              {/* Label row */}
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <span className={`font-medium ${isAtRisk ? 'text-white' : 'text-white/70'}`}>
                    {bucket.label}
                  </span>
                  {bucket.maxRatio <= 1.05 && bucket.count > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-300 rounded animate-pulse">
                      LIQUIDATABLE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-white/60">
                  <span className={`font-semibold ${isAtRisk ? 'text-white' : ''}`}>
                    {bucket.count} positions
                  </span>
                  {bucket.totalDebtUsd > 0 && (
                    <span className="text-xs">
                      {formatUsd(bucket.totalDebtUsd)} debt
                    </span>
                  )}
                </div>
              </div>
              
              {/* Bar */}
              <div className="h-8 bg-white/5 rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-500 ease-out relative overflow-hidden"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: bucket.color,
                    minWidth: bucket.count > 0 ? '8px' : '0',
                  }}
                >
                  {/* Shimmer effect for liquidatable */}
                  {bucket.maxRatio <= 1.05 && bucket.count > 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  )}
                </div>
                
                {/* Hover tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-gray-900/95 border border-white/20 rounded-lg px-3 py-2 text-xs shadow-xl">
                    <div className="font-semibold text-white">
                      {bucket.count} position{bucket.count !== 1 ? 's' : ''}
                    </div>
                    <div className="text-white/60">
                      Risk Ratio: {bucket.label}
                    </div>
                    {bucket.totalDebtUsd > 0 && (
                      <div className="text-white/60">
                        Total Debt: {formatUsd(bucket.totalDebtUsd)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Scale Legend */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>← Higher Risk (Liquidation)</span>
          <span>Lower Risk (Safe) →</span>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden flex">
          {buckets.map((bucket, index) => (
            <div
              key={index}
              className="flex-1 first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: bucket.color }}
            />
          ))}
        </div>
      </div>

      {/* Interpretation */}
      {totalPositions > 0 && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg border border-cyan-500/30">
          <div className="flex items-start gap-2 text-sm">
            <InsightIcon size={20} className="flex-shrink-0 mt-0.5" />
            <div className="text-white/80">
              {buckets[0]?.count > 0 ? (
                <>
                  <span className="font-semibold text-rose-300">
                    {buckets[0].count} position{buckets[0].count !== 1 ? 's' : ''}
                  </span>{' '}
                  can be liquidated now with{' '}
                  <span className="font-semibold">{formatUsd(buckets[0].totalDebtUsd)}</span>{' '}
                  in potential liquidation volume.
                </>
              ) : buckets[1]?.count > 0 ? (
                <>
                  No positions are currently liquidatable, but{' '}
                  <span className="font-semibold text-teal-300">
                    {buckets[1].count} position{buckets[1].count !== 1 ? 's' : ''}
                  </span>{' '}
                  are in the critical zone and may become liquidatable soon.
                </>
              ) : (
                <>
                  All positions have healthy risk ratios. The system is operating with
                  comfortable safety margins.
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add shimmer animation to global styles or tailwind config
const shimmerStyles = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 2s infinite;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = shimmerStyles;
  document.head.appendChild(styleEl);
}

