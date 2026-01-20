import { useState } from "react";

interface RailDividerProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

/**
 * Premium seam divider between main content and right rail.
 * 
 * Design principles:
 * - Lives IN the seam as its own grid column
 * - 2px vertical line always visible (subtle but present)
 * - Small circular nub always visible, brightens on hover
 * - Sticky to viewport center (always reachable while scrolling)
 * - Large invisible hitbox (~44px), small visible control (~18px)
 */
export function RailDivider({ isCollapsed, onToggle }: RailDividerProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="hidden lg:flex relative min-h-[calc(100vh-120px)] w-px items-start justify-center mx-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Vertical seam line - always visible, runs full height */}
      <div 
        className={`
          absolute inset-y-0 left-0 w-[2px] rounded-full
          transition-colors duration-300
          ${isHovered ? "bg-[#2dd4bf]/50" : "bg-white/[0.12]"}
        `}
      />

      {/* Sticky container for the nub - stays at viewport center */}
      <div 
        className="sticky top-[calc(50vh-48px)] flex items-center justify-center z-10"
      >
        {/* Large invisible hitbox - 44px wide, 96px tall */}
        <button
          onClick={onToggle}
          className="relative flex items-center justify-center w-11 h-24 cursor-pointer group"
          aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {/* Small visible nub - always visible, brightens on hover */}
          <div
            className={`
              flex items-center justify-center
              w-[18px] h-[18px] rounded-full
              transition-all duration-200 ease-out
              ${isHovered 
                ? "bg-[#0f2027] border border-[#2dd4bf]/50 shadow-sm shadow-[#2dd4bf]/15 scale-105" 
                : "bg-[#0f2027]/80 border border-white/[0.15]"
              }
            `}
          >
            <svg 
              className={`
                w-2.5 h-2.5 transition-colors duration-200
                ${isHovered ? "text-[#2dd4bf]" : "text-white/40"}
              `}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2.5} 
                d={isCollapsed ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} 
              />
            </svg>
          </div>

          {/* Subtle tooltip - appears on hover, positioned to the right */}
          <div
            className={`
              absolute left-full ml-2
              px-2 py-1 rounded text-[10px] font-medium tracking-wide
              bg-[#0d1a1f]/95 border border-white/[0.08] text-white/50
              whitespace-nowrap shadow-lg pointer-events-none
              transition-all duration-150
              ${isHovered ? "opacity-100 translate-x-0 delay-150" : "opacity-0 -translate-x-1 delay-0"}
            `}
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </div>
        </button>
      </div>
    </div>
  );
}

export default RailDivider;
