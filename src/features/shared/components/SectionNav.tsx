import React from "react";
import {
  OverviewIcon,
  LiquidationIcon,
} from "../../../components/ThemedIcons";

export type DashboardSection =
  | "pools"
  | "liquidations";

interface SectionNavProps {
  selectedSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
}

const sections: {
  id: DashboardSection;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  description: string;
}[] = [
  {
    id: "pools",
    label: "Pools",
    icon: OverviewIcon,
    description: "Protocol metrics and pool analytics",
  },
  {
    id: "liquidations",
    label: "Liquidations",
    icon: LiquidationIcon,
    description: "Live risk monitor and liquidation opportunities",
  },
];

export function SectionNav({
  selectedSection,
  onSelectSection,
}: SectionNavProps) {
  return (
    <div className="mb-4">
      {/* Compact Tab Navigation */}
      <div className="inline-flex items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-700/50">
        {sections.map((section) => {
          const IconComponent = section.icon;
          const isActive = selectedSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              className={`px-4 py-1.5 rounded-md transition-all duration-200 ${
                isActive
                  ? "bg-teal-400 text-slate-900 font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <IconComponent
                  size={16}
                  className={isActive ? "text-slate-900" : "text-cyan-400"}
                />
                <span className="text-sm">{section.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
