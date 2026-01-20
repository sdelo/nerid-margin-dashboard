import React from 'react';
import { useProtocolMetrics } from '../../../hooks/useProtocolMetrics';

export function GlobalMetricsPanel() {
  const metrics = useProtocolMetrics();

  const metricCards = [
    {
      title: 'Total Value Locked',
      value: metrics.totalValueLocked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: <VaultIcon />,
    },
    {
      title: 'Total Borrowed',
      value: metrics.totalBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: <BorrowIcon />,
    },
    {
      title: 'Total Supply',
      value: metrics.totalSupply.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: <SupplyIcon />,
    },
    {
      title: 'Active Margin Managers',
      value: metrics.activeMarginManagers.toLocaleString(),
      icon: <UsersIcon />,
    },
    {
      title: 'Total Liquidations',
      value: metrics.totalLiquidations.toLocaleString(),
      icon: <LiquidationIcon />,
    },
  ];

  if (metrics.error) {
    return (
      <div className="card-surface p-4 rounded-xl border border-red-500/20">
        <p className="text-red-400 text-sm">Error loading protocol metrics: {metrics.error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-white/80 mb-3">Protocol Overview</h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {metricCards.map((card, index) => (
          <div
            key={index}
            className="card-surface p-3 rounded-lg"
          >
            <div className="flex items-center gap-1.5 mb-1.5 text-cyan-400">
              {card.icon}
            </div>
            
            <div className="space-y-0.5">
              <div className="text-base font-bold text-white">
                {metrics.isLoading ? (
                  <div className="h-5 w-16 bg-white/10 rounded animate-pulse"></div>
                ) : (
                  card.value
                )}
              </div>
              <div className="text-[10px] text-white/50">{card.title}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Consistent teal icons
function VaultIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function BorrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 11l-5-5-5 5M12 6v12" />
      <path d="M5 18h14" />
    </svg>
  );
}

function SupplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LiquidationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
