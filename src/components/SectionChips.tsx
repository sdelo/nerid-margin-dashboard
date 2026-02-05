import React from "react";

/* ─── Public types ─────────────────────────────────────────────────── */

export interface SectionItem {
  id: string;
  label: string;
}

export interface SectionGroup {
  id: string;
  label: string;
  items: SectionItem[];
}

/* ─── Props ────────────────────────────────────────────────────────── */

interface SectionChipsProps {
  /** Grouped sections */
  groups: SectionGroup[];
  /** Currently active sub-section id (used to derive active group) */
  activeSection: string;
  /** Fired when user clicks a sub-section chip */
  onSectionClick: (sectionId: string) => void;
  className?: string;
}

/** Given a sub-section id, find which group it belongs to */
function findGroupForSection(groups: SectionGroup[], sectionId: string): string {
  for (const g of groups) {
    if (g.items.some((item) => item.id === sectionId)) return g.id;
  }
  return groups[0]?.id ?? "";
}

/**
 * Two-row section navigation:
 *
 *  Row 1 — Group tabs:  [Overview] [Yield] [Risk] [Activity]
 *  Row 2 — Sub-sections: Rate Model · APY · Markets  (only for active group)
 *
 * Clean, scannable, and doesn't overwhelm with 13 items at once.
 * Row 2 scrolls horizontally on mobile if items overflow.
 */
export function SectionChips({
  groups,
  activeSection,
  onSectionClick,
  className = "",
}: SectionChipsProps) {
  const activeGroupId = findGroupForSection(groups, activeSection);
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const subScrollRef = React.useRef<HTMLDivElement>(null);
  const activeSubRef = React.useRef<HTMLButtonElement>(null);

  // When user clicks a group tab, jump to the first item in that group
  const handleGroupClick = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (group && group.items.length > 0) {
      onSectionClick(group.items[0].id);
    }
  };

  // Auto-scroll the sub-chip row to keep the active chip visible
  React.useEffect(() => {
    if (activeSubRef.current && subScrollRef.current) {
      const chip = activeSubRef.current;
      const container = subScrollRef.current;
      const chipLeft = chip.offsetLeft;
      const chipRight = chipLeft + chip.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const scrollRight = scrollLeft + container.clientWidth;

      if (chipLeft < scrollLeft + 24) {
        container.scrollTo({ left: Math.max(0, chipLeft - 24), behavior: "smooth" });
      } else if (chipRight > scrollRight - 24) {
        container.scrollTo({ left: chipRight - container.clientWidth + 24, behavior: "smooth" });
      }
    }
  }, [activeSection]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* ── Row 1: Group tabs ─────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {groups.map((group) => {
          const isActive = group.id === activeGroupId;
          return (
            <button
              key={group.id}
              onClick={() => handleGroupClick(group.id)}
              className={`
                px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap
                transition-all duration-150 cursor-pointer
                ${
                  isActive
                    ? "bg-[#2dd4bf]/15 text-[#2dd4bf] border border-[#2dd4bf]/30"
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-transparent"
                }
              `}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {/* ── Row 2: Sub-section chips (only for active group) ──────── */}
      {activeGroup && activeGroup.items.length > 1 && (
        <div
          ref={subScrollRef}
          className="flex items-center gap-0.5 overflow-x-auto scrollbar-none
                     bg-slate-800/60 rounded-lg border border-slate-700/30 p-0.5"
        >
          {activeGroup.items.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                ref={isActive ? activeSubRef : undefined}
                onClick={() => onSectionClick(item.id)}
                className={`
                  flex-shrink-0 rounded-md font-medium whitespace-nowrap cursor-pointer
                  transition-all duration-150 px-2.5 py-1 text-[11px]
                  ${
                    isActive
                      ? "bg-[#2dd4bf] text-slate-900 shadow-md shadow-[#2dd4bf]/25"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  }
                `}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SectionChips;
