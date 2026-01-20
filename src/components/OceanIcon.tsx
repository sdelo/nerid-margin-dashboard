import React from "react";

interface OceanIconProps {
  name:
    | "wave"
    | "anchor"
    | "depth-gauge"
    | "treasure-chest"
    | "submarine"
    | "sonar";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
}

import waveIcon from "../assets/icons/wave.svg";
import anchorIcon from "../assets/icons/anchor.svg";
import depthGaugeIcon from "../assets/icons/depth-gauge.svg";
import treasureChestIcon from "../assets/icons/treasure-chest.svg";
import submarineIcon from "../assets/icons/submarine.svg";
import sonarIcon from "../assets/icons/sonar.svg";

const iconPaths = {
  wave: waveIcon,
  anchor: anchorIcon,
  "depth-gauge": depthGaugeIcon,
  "treasure-chest": treasureChestIcon,
  submarine: submarineIcon,
  sonar: sonarIcon,
};

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export function OceanIcon({
  name,
  className = "",
  size = "md",
  animated = false,
}: OceanIconProps) {
  const sizeClass = sizeClasses[size];
  const animationClass = animated ? "animate-pulse" : "";

  return (
    <div className={`${sizeClass} ${animationClass} ${className}`}>
      <img
        src={iconPaths[name]}
        alt={`${name} icon`}
        className="w-full h-full text-cyan-300 hover:text-amber-300 transition-colors duration-300"
      />
    </div>
  );
}







