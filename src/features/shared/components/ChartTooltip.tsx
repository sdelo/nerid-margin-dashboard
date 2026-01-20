import type { FC, ReactNode } from "react";

type PayloadEntry = {
  color?: string;
  name?: string;
  value?: number | string;
  payload?: any;
};

export type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: PayloadEntry[];
  labelFormatter?: (label: string | number | undefined) => ReactNode;
  valueFormatter?: (
    value: number | string | undefined,
    name?: string,
    entry?: PayloadEntry
  ) => ReactNode;
};

// Dark themed tooltip for charts across the app
const ChartTooltip: FC<ChartTooltipProps> = ({
  active,
  label,
  payload,
  labelFormatter,
  valueFormatter,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-xl shadow-xl border"
      style={{
        backgroundColor: "rgba(2, 6, 23, 0.9)", // slate-950 with opacity
        borderColor: "rgba(255,255,255,0.15)",
        color: "#e5e7eb",
        padding: "8px 10px",
        minWidth: 160,
      }}
    >
      {label != null && (
        <div className="text-[11px] text-cyan-100/80 mb-1">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div className="space-y-1 text-sm">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {entry.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
              )}
              <span className="text-cyan-100/90">{entry.name}</span>
            </div>
            <span className="text-teal-300 font-semibold">
              {valueFormatter
                ? valueFormatter(entry.value, entry.name, entry)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartTooltip;
