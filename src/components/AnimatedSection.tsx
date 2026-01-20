import React from "react";
import { useElementOnScreen } from "../hooks/useElementOnScreen";

interface AnimatedSectionProps {
  children: React.ReactNode;
  animation?:
    | "slide-in-left"
    | "slide-in-right"
    | "slide-in-bottom"
    | "slide-in-top"
    | "scale-in"
    | "fade-in-up";
  delay?: number;
  className?: string;
  threshold?: number;
}

export function AnimatedSection({
  children,
  animation = "fade-in-up",
  delay = 0,
  className = "",
  threshold = 0.1,
}: AnimatedSectionProps) {
  const [containerRef, isVisible] = useElementOnScreen({ threshold });

  const delayClass =
    delay > 0 ? `stagger-${Math.min(Math.ceil(delay * 10), 6)}` : "";

  return (
    <div
      ref={containerRef}
      className={`${animation} ${
        isVisible ? "visible" : ""
      } ${delayClass} ${className}`}
      style={{ transitionDelay: delay > 0 ? `${delay}s` : undefined }}
    >
      {children}
    </div>
  );
}








