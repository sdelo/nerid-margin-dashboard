import React from "react";
import { createPortal } from "react-dom";

/**
 * Centralized tooltip definitions for technical terms across the app.
 * Use these keys with the InfoTooltip component for consistency.
 */
export const TOOLTIP_DEFINITIONS = {
  // Pool metrics
  utilizationRate: "Percentage of supplied assets currently borrowed. Higher utilization = higher APY but less available for withdrawal.",
  supplyAPY: "Annual percentage yield earned by depositors, based on borrower interest minus protocol fees.",
  borrowAPR: "Annual percentage rate paid by borrowers. Increases when pool utilization is high.",
  supplyCapUsage: "Current deposits as a percentage of the maximum allowed supply.",
  availableLiquidity: "Funds immediately available for withdrawal. This is what you can access right now without waiting.",
  maxUtilizationRate: "Maximum borrowing allowed relative to total supply.",
  protocolSpread: "Fee retained by the protocol from borrower interest.",
  referralSpread: "Fee retained by the protocol from borrower interest, shared with referrers.",
  
  // Interest rate model
  baseRate: "Minimum interest rate charged even at 0% utilization. The starting point of the interest curve.",
  baseSlope: "Rate of interest increase per unit of utilization below optimal. Controls how fast rates rise initially.",
  optimalUtilization: "Target utilization rate where interest model transitions. Beyond this, rates increase more steeply.",
  excessSlope: "Rate of interest increase above optimal utilization. Designed to discourage over-borrowing.",
  
  // Deposit/Withdraw
  minBorrow: "Minimum amount that can be borrowed from this pool in a single transaction.",
  supplyCap: "Maximum total supply allowed in this pool. Deposits are rejected once this limit is reached.",
  
  // Risk ratios (DeepBook)
  borrowRiskRatio: "Minimum collateral ratio required to borrow. Your position must maintain at least this ratio of assets to debt to take new loans.",
  liquidationRiskRatio: "Threshold below which your position can be liquidated. If your collateral ratio falls below this, liquidators can close your position.",
  withdrawRiskRatio: "Minimum ratio required to withdraw collateral. You cannot withdraw if it would push your position below this threshold.",
  targetLiqRisk: "Target ratio after partial liquidation. When liquidated, the system aims to restore your position to this healthier ratio.",
  poolReward: "Percentage of liquidation amount given to the lending pool as compensation for absorbed risk.",
  userReward: "Percentage of liquidation amount given to the liquidator as incentive for maintaining system health.",
  marginDisabled: "Margin trading is disabled for this pool. Trading and borrowing features are not available until enabled by pool administrators.",
  marginEnabled: "Margin trading is active. You can open leveraged positions and borrow against your collateral in this pool.",
  
  // Pool status
  highLiquidity: "Pool has low utilization with ample available funds for withdrawal.",
  optimalLiquidity: "Pool is operating at target utilization with balanced supply and demand.",
  lowLiquidity: "High utilization may cause withdrawal delays. Consider the exit risk.",
  
  // Activity metrics (7d)
  netFlow7d: "Net capital flow over 7 days. Deposits minus withdrawals—positive means the pool is growing.",
  borrowVolume7d: "Total borrow turnover in 7 days. Shows how actively borrowers are cycling in/out.",
  activeUsers7d: "Unique users active in 7 days. Format: Suppliers / Borrowers.",
  lastActivity: "Time since the most recent pool activity (supply, withdraw, borrow, or repay).",
  
  // Liquidation metrics
  estimatedProfit: "Estimated net profit = Liquidation Bonus − Gas (~$0.50) − Slippage (~0.3% of debt). Actual profit may vary based on market conditions and execution.",
  positionDirection: "LONG: Net long base asset—hurts when price drops. SHORT: Net short base asset—benefits when price drops.",
} as const;

export type TooltipKey = keyof typeof TOOLTIP_DEFINITIONS;

interface InfoTooltipProps {
  /** Either a tooltip key from TOOLTIP_DEFINITIONS or a custom string */
  tooltip: TooltipKey | string;
  /** Size variant */
  size?: "sm" | "md";
  /** Position of the tooltip */
  position?: "top" | "bottom" | "left" | "right";
}

/**
 * A small info icon that shows a tooltip on hover.
 * Use this next to technical terms to help users understand their meaning.
 * 
 * @example
 * // Using a predefined tooltip key
 * <InfoTooltip tooltip="utilizationRate" />
 * 
 * @example
 * // Using a custom tooltip string
 * <InfoTooltip tooltip="Custom explanation here" />
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  tooltip, 
  size = "sm",
  position = "top" 
}) => {
  const [show, setShow] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  
  // Resolve the tooltip text - either from definitions or use the raw string
  const tooltipText = tooltip in TOOLTIP_DEFINITIONS 
    ? TOOLTIP_DEFINITIONS[tooltip as TooltipKey] 
    : tooltip;

  const sizeClasses = size === "sm" 
    ? "w-3.5 h-3.5 text-[9px]" 
    : "w-4 h-4 text-[10px]";
  
  const tooltipWidthPx = size === "sm" ? 208 : 256; // w-52 = 208px, w-64 = 256px

  // Calculate tooltip position based on button position and viewport bounds
  const updatePosition = React.useCallback(() => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const padding = 8; // Distance from button
    const viewportPadding = 12; // Minimum distance from viewport edges
    
    let top = 0;
    let left = 0;
    
    // Calculate initial position based on preferred position
    switch (position) {
      case "top":
        top = rect.top - padding;
        left = rect.left + rect.width / 2;
        break;
      case "bottom":
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - padding;
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + padding;
        break;
    }
    
    // Clamp horizontal position to stay within viewport
    const halfWidth = tooltipWidthPx / 2;
    if (position === "top" || position === "bottom") {
      left = Math.max(viewportPadding + halfWidth, Math.min(left, window.innerWidth - viewportPadding - halfWidth));
    }
    
    setCoords({ top, left });
  }, [position, tooltipWidthPx]);

  React.useEffect(() => {
    if (show) {
      updatePosition();
      // Update position on scroll/resize
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [show, updatePosition]);

  const getTooltipStyle = (): React.CSSProperties => {
    switch (position) {
      case "top":
        return {
          position: "fixed",
          top: coords.top,
          left: coords.left,
          transform: "translate(-50%, -100%)",
          width: tooltipWidthPx,
        };
      case "bottom":
        return {
          position: "fixed",
          top: coords.top,
          left: coords.left,
          transform: "translate(-50%, 0)",
          width: tooltipWidthPx,
        };
      case "left":
        return {
          position: "fixed",
          top: coords.top,
          left: coords.left,
          transform: "translate(-100%, -50%)",
          width: tooltipWidthPx,
        };
      case "right":
        return {
          position: "fixed",
          top: coords.top,
          left: coords.left,
          transform: "translate(0, -50%)",
          width: tooltipWidthPx,
        };
      default:
        return {
          position: "fixed",
          top: coords.top,
          left: coords.left,
          transform: "translate(-50%, -100%)",
          width: tooltipWidthPx,
        };
    }
  };

  const getArrowStyle = (): React.CSSProperties => {
    switch (position) {
      case "top":
        return { bottom: -8, left: "50%", transform: "translateX(-50%)", borderWidth: 4, borderColor: "transparent", borderTopColor: "rgb(30, 41, 59)" };
      case "bottom":
        return { top: -8, left: "50%", transform: "translateX(-50%)", borderWidth: 4, borderColor: "transparent", borderBottomColor: "rgb(30, 41, 59)" };
      case "left":
        return { right: -8, top: "50%", transform: "translateY(-50%)", borderWidth: 4, borderColor: "transparent", borderLeftColor: "rgb(30, 41, 59)" };
      case "right":
        return { left: -8, top: "50%", transform: "translateY(-50%)", borderWidth: 4, borderColor: "transparent", borderRightColor: "rgb(30, 41, 59)" };
      default:
        return { bottom: -8, left: "50%", transform: "translateX(-50%)", borderWidth: 4, borderColor: "transparent", borderTopColor: "rgb(30, 41, 59)" };
    }
  };

  const tooltipContent = show && createPortal(
    <div 
      ref={tooltipRef}
      style={getTooltipStyle()}
      className="z-[9999] px-2.5 py-2 text-[11px] text-white/90 bg-slate-800 border border-slate-700 rounded-lg shadow-xl leading-relaxed pointer-events-none"
    >
      {tooltipText}
      <div 
        style={{ position: "absolute", ...getArrowStyle() }}
      />
    </div>,
    document.body
  );

  return (
    <div className="relative inline-flex ml-1">
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className={`${sizeClasses} rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white/70 transition-all cursor-help`}
        aria-label="More info"
      >
        ?
      </button>
      {tooltipContent}
    </div>
  );
};

export default InfoTooltip;
