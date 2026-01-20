import React from 'react';
import type { TimeRange } from '../features/lending/api/types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  options?: TimeRange[];
  className?: string;
}

/**
 * Time range selector component with consistent styling
 */
export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  options = ['1W', '1M', '3M', 'YTD', 'ALL'],
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-xs text-white/60">Range</span>
      <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden flex">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`px-3 py-1.5 text-sm transition-all ${
              value === option
                ? 'bg-teal-400 text-slate-900 font-medium'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeRangeSelector;

