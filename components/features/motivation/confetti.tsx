"use client";

import { motion, useReducedMotion } from "framer-motion";

// A one-shot confetti burst. Rendered while a celebration condition holds
// (e.g. a perfect day). Respects prefers-reduced-motion by rendering nothing.
const COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#e879f9", "#f43f5e"];
const PIECES = Array.from({ length: 28 }, (_, i) => i);

export function Confetti() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {PIECES.map((i) => {
        const left = (i * 37) % 100;
        const delay = (i % 7) * 0.05;
        const drift = ((i % 5) - 2) * 24;
        const color = COLORS[i % COLORS.length];
        return (
          <motion.span
            key={i}
            initial={{ opacity: 1, y: -10, x: 0, rotate: 0 }}
            animate={{ opacity: 0, y: 220, x: drift, rotate: 320 }}
            transition={{ duration: 1.4, delay, ease: "easeOut" }}
            style={{ left: `${left}%`, backgroundColor: color }}
            className="absolute top-0 size-2 rounded-[2px]"
          />
        );
      })}
    </div>
  );
}
