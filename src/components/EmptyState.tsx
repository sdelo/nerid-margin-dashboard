import React from 'react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Empty state component for when there's no data to display
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data available',
  message,
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="mb-4 text-cyan-300/60">{icon}</div>}
      <h3 className="text-lg font-semibold text-cyan-200 mb-2">{title}</h3>
      {message && (
        <p className="text-sm text-cyan-100/80 max-w-md mb-4">{message}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;

