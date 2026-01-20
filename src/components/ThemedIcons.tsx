import React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

// Base diving helmet theme colors
const helmetGradient = "from-cyan-400 via-teal-400 to-cyan-600";
const glassGradient = "from-teal-300/70 via-cyan-400/50 to-teal-400/80";

// Overview/Analytics icon - Helmet with gauge
export function OverviewIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="helmetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* Helmet dome */}
      <ellipse
        cx="12"
        cy="11"
        rx="8"
        ry="7"
        fill="url(#helmetGrad)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      {/* Viewing port */}
      <ellipse
        cx="12"
        cy="11"
        rx="5"
        ry="4"
        fill="url(#glassGrad)"
        stroke="#2dd4bf"
        strokeWidth="0.5"
      />
      {/* Gauge line */}
      <path d="M 8 11 L 16 11" stroke="#0c4a6e" strokeWidth="0.5" />
      <circle
        cx="12"
        cy="11"
        r="1.5"
        fill="#22d3ee"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      {/* Side ports */}
      <circle
        cx="5"
        cy="11"
        r="1.5"
        fill="url(#glassGrad)"
        stroke="#2dd4bf"
        strokeWidth="0.3"
      />
      <circle
        cx="19"
        cy="11"
        r="1.5"
        fill="url(#glassGrad)"
        stroke="#2dd4bf"
        strokeWidth="0.3"
      />
      {/* Top valve */}
      <rect
        x="11"
        y="3"
        width="2"
        height="2"
        rx="0.5"
        fill="url(#helmetGrad)"
        stroke="#0c4a6e"
        strokeWidth="0.3"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="7"
        ry="1.5"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
    </svg>
  );
}

// Lending/Supply icon - Helmet with coins
export function LendingIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="helmetGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Simplified helmet */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#helmetGrad2)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Coins/gems inside */}
      <circle
        cx="10"
        cy="11"
        r="1.2"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.4"
      />
      <circle
        cx="14"
        cy="13"
        r="1.2"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.4"
      />
      <circle
        cx="12"
        cy="13"
        r="0.9"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.3"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Borrowing icon - Helmet with arrow out
export function BorrowingIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="helmetGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Helmet */}
      <ellipse
        cx="11"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#helmetGrad3)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="11"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Arrow pointing out */}
      <path
        d="M 15 12 L 20 12 M 18 10 L 20 12 L 18 14"
        stroke="#f59e0b"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom collar */}
      <ellipse
        cx="11"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Liquidation icon - Helmet with alert
export function LiquidationIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="helmetGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Helmet */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#helmetGrad4)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Warning symbol inside */}
      <path
        d="M 12 9 L 12 13"
        stroke="#ef4444"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="12" cy="14.5" r="0.5" fill="#ef4444" />
      {/* Alert triangles on sides */}
      <path
        d="M 6 12 L 7 10 L 8 12 Z"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.3"
      />
      <path
        d="M 16 12 L 17 10 L 18 12 Z"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.3"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Admin icon - Helmet with gear
export function AdminIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="helmetGrad5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Helmet */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#helmetGrad5)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Gear inside */}
      <circle
        cx="12"
        cy="12"
        r="2"
        fill="none"
        stroke="#0c4a6e"
        strokeWidth="0.8"
      />
      <circle cx="12" cy="12" r="0.8" fill="#164e63" />
      {/* Gear teeth */}
      <circle cx="12" cy="9.5" r="0.5" fill="#164e63" />
      <circle cx="12" cy="14.5" r="0.5" fill="#164e63" />
      <circle cx="9.5" cy="12" r="0.5" fill="#164e63" />
      <circle cx="14.5" cy="12" r="0.5" fill="#164e63" />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Yield icon - Helmet with upward graph
export function YieldIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="helmetGrad6" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Helmet */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#helmetGrad6)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Graph line */}
      <path
        d="M 8 14 L 10 12 L 12 13 L 14 10 L 16 11"
        stroke="#10b981"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arrow up */}
      <path
        d="M 16 11 L 16 9 M 15 10 L 16 9 L 17 10"
        stroke="#10b981"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Liquidity icon - Helmet with water drops
export function LiquidityIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="helmetGrad7" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Helmet */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#helmetGrad7)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Water drops */}
      <path
        d="M 10 11 Q 10 9 10 9.5 Q 10 10 10 11 Z"
        fill="#22d3ee"
        stroke="#06b6d4"
        strokeWidth="0.3"
      />
      <path
        d="M 13 13 Q 13 11 13 11.5 Q 13 12 13 13 Z"
        fill="#22d3ee"
        stroke="#06b6d4"
        strokeWidth="0.3"
      />
      <path
        d="M 11.5 13.5 Q 11.5 12.5 11.5 13 Q 11.5 13.2 11.5 13.5 Z"
        fill="#22d3ee"
        stroke="#06b6d4"
        strokeWidth="0.3"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Whale Watch icon - Helmet with whale
export function WhaleIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="helmetGrad8" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Helmet */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#helmetGrad8)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Simplified whale */}
      <ellipse
        cx="11"
        cy="12"
        rx="3"
        ry="1.5"
        fill="#0c4a6e"
        fillOpacity="0.6"
      />
      <path d="M 14 12 L 15 11 L 15 13 Z" fill="#0c4a6e" fillOpacity="0.6" />
      <circle cx="10" cy="11.5" r="0.4" fill="#22d3ee" />
      {/* Water spout */}
      <path
        d="M 11 10 L 11 8.5 M 10.5 9 L 11 8.5 L 11.5 9"
        stroke="#22d3ee"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Lightning bolt icon - For liquidation events
export function BoltIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path
        d="M13 2L4 14h7v8l9-12h-7V2z"
        fill="url(#boltGrad)"
        stroke="#b45309"
        strokeWidth="0.5"
      />
    </svg>
  );
}

// Treasure chest icon - For volume/value metrics
export function TreasureIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="chestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Chest body */}
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="1"
        fill="url(#chestGrad)"
        stroke="#92400e"
        strokeWidth="0.5"
      />
      {/* Chest lid */}
      <path
        d="M4 10 Q12 4 20 10"
        fill="#fcd34d"
        stroke="#92400e"
        strokeWidth="0.5"
      />
      {/* Lock */}
      <circle
        cx="12"
        cy="13"
        r="2"
        fill="#0c4a6e"
        stroke="#164e63"
        strokeWidth="0.3"
      />
      <rect x="11" y="13" width="2" height="3" fill="#0c4a6e" />
      {/* Coins inside */}
      <ellipse
        cx="8"
        cy="16"
        rx="2"
        ry="1"
        fill="#fde68a"
        stroke="#fbbf24"
        strokeWidth="0.3"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="2"
        ry="1"
        fill="#fde68a"
        stroke="#fbbf24"
        strokeWidth="0.3"
      />
    </svg>
  );
}

// Depth gauge icon - For metrics/measurements
export function DepthGaugeIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* Gauge body */}
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="url(#gaugeGrad)"
        stroke="#0c4a6e"
        strokeWidth="1"
      />
      <circle
        cx="12"
        cy="12"
        r="7"
        fill="#164e63"
        stroke="#0e7490"
        strokeWidth="0.5"
      />
      {/* Tick marks */}
      <path
        d="M12 5.5V7"
        stroke="#5eead4"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M12 17V18.5"
        stroke="#5eead4"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M5.5 12H7"
        stroke="#5eead4"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M17 12H18.5"
        stroke="#5eead4"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      {/* Needle */}
      <path
        d="M12 12L15 9"
        stroke="#22d3ee"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.5" fill="#2dd4bf" />
    </svg>
  );
}

// Warning/Alert icon - Helmet with warning symbol
export function AlertIcon({
  className = "",
  size = 24,
  variant = "warning",
}: IconProps & { variant?: "warning" | "danger" | "success" }) {
  const colors = {
    warning: { fill: "#fbbf24", stroke: "#92400e" },
    danger: { fill: "#ef4444", stroke: "#7f1d1d" },
    success: { fill: "#10b981", stroke: "#065f46" },
  };
  const { fill, stroke } = colors[variant];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Triangle */}
      <path
        d="M12 3L22 20H2L12 3Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.5"
      />
      {/* Exclamation mark */}
      <path
        d="M12 9V14"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill={stroke} />
    </svg>
  );
}

// Checkmark icon - For success states
export function CheckIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="url(#checkGrad)"
        stroke="#065f46"
        strokeWidth="0.5"
      />
      <path
        d="M7 12L10.5 15.5L17 9"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Chart/Analytics icon - For data visualization
export function ChartIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="chartGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      {/* Grid lines */}
      <path d="M2 17H22" stroke="#0e7490" strokeWidth="0.3" />
      <path d="M2 12H22" stroke="#0e7490" strokeWidth="0.3" />
      <path d="M2 7H22" stroke="#0e7490" strokeWidth="0.3" />
      {/* Chart line */}
      <path
        d="M4 16L8 12L12 14L16 8L20 10"
        stroke="url(#chartGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arrow up */}
      <path
        d="M18 6L20 10M20 10L22 8"
        stroke="#2dd4bf"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Diamond icon - For top suppliers/value
export function DiamondIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="diamondShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Diamond shape */}
      <path
        d="M12 2L4 8L12 22L20 8L12 2Z"
        fill="url(#diamondGrad)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      {/* Top facet */}
      <path
        d="M12 2L4 8H20L12 2Z"
        fill="#a5f3fc"
        stroke="#0c4a6e"
        strokeWidth="0.3"
      />
      {/* Center line */}
      <path
        d="M4 8L12 12L20 8"
        stroke="#0c4a6e"
        strokeWidth="0.3"
        fill="none"
      />
      <path d="M12 12V22" stroke="#0c4a6e" strokeWidth="0.3" />
      {/* Shine */}
      <path d="M7 8L12 5L10 8Z" fill="url(#diamondShine)" />
    </svg>
  );
}

// Info/Lightbulb icon - For insights
export function InsightIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bulbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Bulb */}
      <path
        d="M12 2C8.13 2 5 5.13 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.13 15.87 2 12 2Z"
        fill="url(#bulbGrad)"
        stroke="#92400e"
        strokeWidth="0.5"
      />
      {/* Light rays */}
      <path
        d="M12 0V1"
        stroke="#fbbf24"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M4.22 4.22L4.93 4.93"
        stroke="#fbbf24"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M19.78 4.22L19.07 4.93"
        stroke="#fbbf24"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path d="M2 9H3" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />
      <path
        d="M21 9H22"
        stroke="#fbbf24"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Base */}
      <rect x="9" y="19" width="6" height="1" rx="0.5" fill="#164e63" />
      <rect x="9" y="21" width="6" height="1" rx="0.5" fill="#164e63" />
      <path d="M10 22V23H14V22" stroke="#0c4a6e" strokeWidth="0.5" />
    </svg>
  );
}

// Clock icon - For transaction history
export function ClockIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M12 6V12L16 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Lock icon - For connect wallet
export function LockIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="lockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Lock body */}
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        fill="url(#lockGrad)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      {/* Shackle */}
      <path
        d="M8 11V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V11"
        stroke="#164e63"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Keyhole */}
      <circle cx="12" cy="15" r="1.5" fill="#164e63" />
      <path
        d="M12 16.5V18"
        stroke="#164e63"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Error/Cross icon - For error states
export function ErrorIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="errorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="url(#errorGrad)"
        stroke="#7f1d1d"
        strokeWidth="0.5"
      />
      <path
        d="M8 8L16 16M16 8L8 16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Anchor icon - For stability/security
export function AnchorIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="anchorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Ring */}
      <circle
        cx="12"
        cy="5"
        r="2.5"
        stroke="url(#anchorGrad)"
        strokeWidth="2"
        fill="none"
      />
      {/* Shaft */}
      <path
        d="M12 7.5V20"
        stroke="url(#anchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Arms */}
      <path
        d="M5 17L12 20L19 17"
        stroke="url(#anchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Cross bar */}
      <path
        d="M8 12H16"
        stroke="url(#anchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Borrowers icon - Submarine going down
export function BorrowersIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="subGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Submarine body */}
      <ellipse
        cx="12"
        cy="12"
        rx="8"
        ry="4"
        fill="url(#subGrad)"
        stroke="#92400e"
        strokeWidth="0.5"
      />
      {/* Conning tower */}
      <rect
        x="10"
        y="6"
        width="4"
        height="4"
        rx="1"
        fill="#fbbf24"
        stroke="#92400e"
        strokeWidth="0.5"
      />
      {/* Periscope */}
      <path
        d="M12 6V3M12 3H14"
        stroke="#164e63"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Windows */}
      <circle
        cx="8"
        cy="12"
        r="1.5"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.3"
      />
      <circle
        cx="12"
        cy="12"
        r="1.5"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.3"
      />
      <circle
        cx="16"
        cy="12"
        r="1.5"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.3"
      />
      {/* Arrow down */}
      <path
        d="M12 17V21M10 19L12 21L14 19"
        stroke="#ef4444"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// History icon - Diving helmet with hourglass/time waves
export function HistoryIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="historyHelmetGrad"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="hourglassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {/* Helmet dome */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#historyHelmetGrad)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Hourglass shape inside */}
      <path
        d="M9 9H15L12 12L15 15H9L12 12L9 9Z"
        fill="url(#hourglassGrad)"
        stroke="#5b21b6"
        strokeWidth="0.4"
      />
      {/* Sand particles */}
      <circle cx="12" cy="11" r="0.4" fill="#ddd6fe" />
      <circle cx="11.5" cy="10.5" r="0.3" fill="#ddd6fe" />
      <circle cx="12.5" cy="10.5" r="0.3" fill="#ddd6fe" />
      {/* Time wave ripples outside helmet */}
      <path
        d="M3 12C4 10.5 5 13.5 6 12"
        stroke="#a78bfa"
        strokeWidth="0.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M18 12C19 10.5 20 13.5 21 12"
        stroke="#a78bfa"
        strokeWidth="0.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Concentration icon - Diving helmet with converging currents/vortex
export function ConcentrationIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="concHelmetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="vortexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      {/* Helmet dome */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#concHelmetGrad)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Spiral/vortex pattern showing concentration */}
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke="url(#vortexGrad)"
        strokeWidth="0.8"
        strokeDasharray="2 1"
      />
      <circle
        cx="12"
        cy="12"
        r="1.5"
        fill="none"
        stroke="#fb923c"
        strokeWidth="0.6"
      />
      <circle cx="12" cy="12" r="0.6" fill="#f97316" />
      {/* Converging arrows */}
      <path
        d="M8 9L10 11"
        stroke="#f97316"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M16 9L14 11"
        stroke="#f97316"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M8 15L10 13"
        stroke="#f97316"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M16 15L14 13"
        stroke="#f97316"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Pool Activity icon - Diving helmet with flowing waves and tide lines
export function PoolActivityIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="activityHelmetGrad"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {/* Helmet dome */}
      <ellipse
        cx="12"
        cy="12"
        rx="7"
        ry="6"
        fill="url(#activityHelmetGrad)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Rising bars inside helmet (TVL growth) */}
      <rect x="9" y="13" width="1.2" height="2" fill="#10b981" rx="0.3" />
      <rect x="11" y="11" width="1.2" height="4" fill="#34d399" rx="0.3" />
      <rect
        x="13"
        y="10"
        width="1.2"
        height="5"
        fill="url(#waveGrad)"
        rx="0.3"
      />
      {/* Wave line above bars */}
      <path
        d="M8.5 10C9.5 9 10.5 11 11.5 10C12.5 9 13.5 11 14.5 10"
        stroke="#2dd4bf"
        strokeWidth="0.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Flow arrows on sides */}
      <path
        d="M4.5 10L6 12L4.5 14"
        stroke="#10b981"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M19.5 10L18 12L19.5 14"
        stroke="#ef4444"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="17"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// Harpoon icon - For targeting liquidatable positions
export function HarpoonIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="harpoonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="harpoonShaft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Harpoon tip */}
      <path
        d="M4 4L8 8L6 10L4 8L4 4Z"
        fill="url(#harpoonGrad)"
        stroke="#9f1239"
        strokeWidth="0.5"
      />
      <path
        d="M4 4L10 4L8 8L4 4Z"
        fill="url(#harpoonGrad)"
        stroke="#9f1239"
        strokeWidth="0.5"
      />
      {/* Barb */}
      <path
        d="M7 7L5 9"
        stroke="#9f1239"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Shaft */}
      <path
        d="M8 8L20 20"
        stroke="url(#harpoonShaft)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Rope detail */}
      <path
        d="M16 16L18 14"
        stroke="#164e63"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M18 18L20 16"
        stroke="#164e63"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Target circle */}
      <circle
        cx="6"
        cy="6"
        r="8"
        fill="none"
        stroke="#fb7185"
        strokeWidth="0.5"
        strokeDasharray="2 2"
        opacity="0.5"
      />
    </svg>
  );
}

// Trident icon - For leaderboard/champions
export function TridentIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="tridentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="tridentShaft" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* Center prong */}
      <path
        d="M12 2L12 8"
        stroke="url(#tridentGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 4L12 2L14 4"
        stroke="url(#tridentGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Left prong */}
      <path
        d="M7 6L9 10"
        stroke="url(#tridentGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 7L7 6L7 9"
        stroke="url(#tridentGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Right prong */}
      <path
        d="M17 6L15 10"
        stroke="url(#tridentGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19 7L17 6L17 9"
        stroke="url(#tridentGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Cross bar */}
      <path
        d="M9 10H15"
        stroke="url(#tridentGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Shaft */}
      <path
        d="M12 10V22"
        stroke="url(#tridentShaft)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Shaft details */}
      <circle cx="12" cy="14" r="1" fill="#164e63" />
      <circle cx="12" cy="18" r="0.8" fill="#164e63" />
    </svg>
  );
}

// Depth Pressure icon - For at-risk/danger states (diving helmet under pressure)
export function DepthPressureIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="pressureHelmetGrad"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Pressure waves */}
      <path
        d="M3 8C4.5 6 4.5 10 6 8"
        stroke="#fbbf24"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M18 8C19.5 6 19.5 10 21 8"
        stroke="#fbbf24"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M3 16C4.5 14 4.5 18 6 16"
        stroke="#fbbf24"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M18 16C19.5 14 19.5 18 21 16"
        stroke="#fbbf24"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Helmet dome */}
      <ellipse
        cx="12"
        cy="12"
        rx="6"
        ry="5"
        fill="url(#pressureHelmetGrad)"
        stroke="#92400e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="3.5"
        ry="2.8"
        fill="#fef3c7"
        fillOpacity="0.4"
        stroke="#f59e0b"
        strokeWidth="0.4"
      />
      {/* Warning indicator */}
      <path
        d="M12 10V13"
        stroke="#92400e"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="14.2" r="0.6" fill="#92400e" />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="16.5"
        rx="5"
        ry="1"
        fill="#92400e"
        stroke="#78350f"
        strokeWidth="0.4"
      />
      {/* Pressure arrows pointing in */}
      <path
        d="M6 12L8 12"
        stroke="#f59e0b"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M18 12L16 12"
        stroke="#f59e0b"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Broken Anchor icon - For bad debt/losses
export function BrokenAnchorIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="brokenAnchorGrad"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      {/* Ring (broken) */}
      <path
        d="M9 5C9 3.34 10.34 2 12 2"
        stroke="url(#brokenAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M15 5C15 3.34 13.66 2 12 2"
        stroke="url(#brokenAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Shaft (broken in middle) */}
      <path
        d="M12 7V11"
        stroke="url(#brokenAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 14V20"
        stroke="url(#brokenAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Break marks */}
      <path
        d="M10 12L14 13"
        stroke="#fb7185"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M10 13L14 12"
        stroke="#fb7185"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Arms (one broken) */}
      <path
        d="M5 17L12 20"
        stroke="url(#brokenAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19 17L16 18.5"
        stroke="url(#brokenAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 1"
      />
      {/* Cross bar */}
      <path
        d="M8 11H11"
        stroke="url(#brokenAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 11H16"
        stroke="url(#brokenAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 1"
      />
    </svg>
  );
}

// Healthy Anchor icon - For healthy/no bad debt states
export function HealthyAnchorIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="healthyAnchorGrad"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {/* Ring */}
      <circle
        cx="12"
        cy="4"
        r="2"
        stroke="url(#healthyAnchorGrad)"
        strokeWidth="2"
        fill="none"
      />
      {/* Shaft */}
      <path
        d="M12 6V20"
        stroke="url(#healthyAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Arms */}
      <path
        d="M5 17L12 20L19 17"
        stroke="url(#healthyAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Cross bar */}
      <path
        d="M8 11H16"
        stroke="url(#healthyAnchorGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Checkmark overlay */}
      <circle cx="18" cy="6" r="4" fill="#10b981" />
      <path
        d="M16 6L17.5 7.5L20 5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Liquidation Center icon - Diving helmet with pressure gauge in danger zone
export function LiquidationCenterIcon({
  className = "",
  size = 24,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="liqCenterHelmet"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="dangerGauge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      {/* Helmet dome */}
      <ellipse
        cx="12"
        cy="11"
        rx="7"
        ry="6"
        fill="url(#liqCenterHelmet)"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      <ellipse
        cx="12"
        cy="11"
        rx="4.5"
        ry="3.5"
        fill="#5eead4"
        fillOpacity="0.3"
        stroke="#2dd4bf"
        strokeWidth="0.4"
      />
      {/* Pressure gauge inside */}
      <circle
        cx="12"
        cy="11"
        r="2.5"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.5"
      />
      {/* Gauge arc (danger zone) */}
      <path
        d="M10 12.5A2.5 2.5 0 0114 12.5"
        stroke="url(#dangerGauge)"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      {/* Needle pointing to danger */}
      <path
        d="M12 11L14 10"
        stroke="#ef4444"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="12" cy="11" r="0.6" fill="#ef4444" />
      {/* Side warning lights */}
      <circle cx="6" cy="11" r="1" fill="#ef4444" opacity="0.8" />
      <circle cx="18" cy="11" r="1" fill="#ef4444" opacity="0.8" />
      {/* Bottom collar */}
      <ellipse
        cx="12"
        cy="16.5"
        rx="6"
        ry="1.2"
        fill="#164e63"
        stroke="#0c4a6e"
        strokeWidth="0.4"
      />
      {/* Alert indicator at top */}
      <path d="M12 4L13 6H11L12 4Z" fill="#ef4444" />
    </svg>
  );
}
