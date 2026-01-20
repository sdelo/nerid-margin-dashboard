import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  height?: string;
}

/**
 * Loading skeleton component for consistent loading states
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = '',
  lines = 1,
  height = 'h-4',
}) => {
  if (lines === 1) {
    return (
      <div
        className={`animate-pulse bg-white/10 rounded ${height} ${className}`}
      />
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-white/10 rounded ${height} ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
};

export default LoadingSkeleton;

