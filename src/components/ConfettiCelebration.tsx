import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  gravity: number;
  drag: number;
  /** 0 = rectangle, 1 = circle, 2 = star */
  shape: number;
}

interface ConfettiCelebrationProps {
  /** Whether confetti is active */
  active: boolean;
  /** Duration in ms before auto-cleanup (default 4000) */
  duration?: number;
  /** Number of particles (default 120) */
  particleCount?: number;
  /** Callback when the animation completes */
  onComplete?: () => void;
}

// ── Color palette — DeFi celebration vibes ──────────────────────────
const COLORS = [
  "#2dd4bf", // teal (brand)
  "#34d399", // emerald
  "#fbbf24", // amber/gold
  "#f472b6", // pink
  "#818cf8", // indigo
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#fb923c", // orange
  "#22d3ee", // cyan
  "#ffffff", // white sparkle
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Full-screen canvas confetti burst.
 * Pure React + Canvas — no external dependencies.
 */
export function ConfettiCelebration({
  active,
  duration = 4000,
  particleCount = 120,
  onComplete,
}: ConfettiCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);

  const createParticles = useCallback(
    (width: number, height: number) => {
      const particles: Particle[] = [];
      // Two burst origins — left-center and right-center for a full spread
      const origins = [
        { x: width * 0.3, y: height * 0.35 },
        { x: width * 0.7, y: height * 0.35 },
        { x: width * 0.5, y: height * 0.25 },
      ];

      for (let i = 0; i < particleCount; i++) {
        const origin = origins[i % origins.length];
        const angle = randomBetween(0, Math.PI * 2);
        const speed = randomBetween(4, 14);

        particles.push({
          x: origin.x + randomBetween(-30, 30),
          y: origin.y + randomBetween(-20, 20),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - randomBetween(2, 6), // upward bias
          rotation: randomBetween(0, Math.PI * 2),
          rotationSpeed: randomBetween(-0.15, 0.15),
          width: randomBetween(4, 10),
          height: randomBetween(6, 14),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          opacity: 1,
          gravity: randomBetween(0.08, 0.14),
          drag: randomBetween(0.97, 0.995),
          shape: Math.floor(Math.random() * 3),
        });
      }
      return particles;
    },
    [particleCount]
  );

  const drawStar = useCallback(
    (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
      const spikes = 5;
      const outerRadius = r;
      const innerRadius = r * 0.4;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);

      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(
          cx + Math.cos(rot) * outerRadius,
          cy + Math.sin(rot) * outerRadius
        );
        rot += step;
        ctx.lineTo(
          cx + Math.cos(rot) * innerRadius,
          cy + Math.sin(rot) * innerRadius
        );
        rot += step;
      }

      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
    },
    []
  );

  useEffect(() => {
    if (!active) {
      // Clean up any running animation
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      particlesRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size canvas to window
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Create particles
    particlesRef.current = createParticles(canvas.width, canvas.height);
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let aliveCount = 0;

      for (const p of particlesRef.current) {
        // Physics
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Fade out in the last 40% of duration
        if (progress > 0.6) {
          p.opacity = Math.max(0, 1 - (progress - 0.6) / 0.4);
        }

        // Skip if invisible or off-screen
        if (p.opacity <= 0 || p.y > canvas.height + 50) continue;
        aliveCount++;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 0) {
          // Rectangle confetti
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        } else if (p.shape === 1) {
          // Circle
          ctx.beginPath();
          ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Star
          drawStar(ctx, 0, 0, p.width / 2 + 1);
        }

        ctx.restore();
      }

      if (progress < 1 && aliveCount > 0) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = 0;
        onComplete?.();
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [active, duration, createParticles, drawStar, onComplete]);

  if (!active) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    />,
    document.body
  );
}
