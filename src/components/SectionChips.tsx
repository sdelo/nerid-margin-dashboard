import React from "react";

export interface SectionConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SectionChipsProps {
  sections: SectionConfig[];
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
  className?: string;
  /** When true, chips are in compact mode (less padding, smaller) */
  isCompact?: boolean;
}

/**
 * Section navigation chips for scrollable tab content.
 * Supports compact mode for when sticky to avoid eating up viewport.
 */
export function SectionChips({
  sections,
  activeSection,
  onSectionClick,
  className = "",
  isCompact = false,
}: SectionChipsProps) {
  return (
    <div
      className={`
        flex items-center gap-1 bg-slate-800/90 backdrop-blur-md rounded-lg border border-slate-700/50
        transition-all duration-200
        ${isCompact ? "p-0.5" : "p-1"}
        ${className}
      `}
    >
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={`
              flex items-center gap-1 rounded-md font-medium
              transition-all duration-200
              ${isCompact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"}
              ${
                isActive
                  ? "bg-[#2dd4bf] text-slate-900 shadow-lg shadow-[#2dd4bf]/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }
            `}
          >
            {section.icon && !isCompact && (
              <span className={isActive ? "text-slate-900" : "text-slate-500"}>
                {section.icon}
              </span>
            )}
            {section.label}
          </button>
        );
      })}
    </div>
  );
}

export default SectionChips;
