import React from "react";

interface SectionHeaderProps {
  /** Primary title text */
  title: string;
  /** Optional icon element to display before the title */
  icon?: React.ReactNode;
  /** Optional 1-line description text */
  description?: string;
  /** Optional right-aligned controls (time range selectors, filters, etc.) */
  controls?: React.ReactNode;
}

/**
 * Consistent header for chart/data sections.
 * 
 * Features:
 * - Clean Activity tab style (2xl bold title + subtitle)
 * - Right-aligned controls slot
 * - Minimal, consistent styling
 * 
 * Usage:
 * ```tsx
 * <SectionHeader
 *   title="Pool Activity"
 *   description="TVL changes and deposit/withdrawal flows for SUI"
 *   controls={<TimeRangeSelector />}
 * />
 * ```
 */
export function SectionHeader({
  title,
  icon,
  description,
  controls,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          {icon && <span className="text-teal-400">{icon}</span>}
          {title}
        </h2>
        {description && (
          <p className="text-sm text-white/60">
            {description}
          </p>
        )}
      </div>
      {controls}
    </div>
  );
}

export default SectionHeader;
