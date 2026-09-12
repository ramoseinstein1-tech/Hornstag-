"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type HudCard = {
  id: string;
  top: string;
  left: string;
  anchor: { x: number; y: number };
  delay: number;
  content: ReactNode;
};

const cards: HudCard[] = [
  {
    id: "player",
    top: "9%",
    left: "57%",
    anchor: { x: 58, y: 12 },
    delay: 1.0,
    content: (
      <>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-orange" />
            <span className="font-mono-tech text-[0.62rem] tracking-[0.18em] text-orange-bright">
              PLAYER #23
            </span>
          </span>
          <span className="font-mono-tech text-[0.58rem] text-text-faint">SG</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
          {[
            ["PTS", "24", true],
            ["REB", "6", false],
            ["AST", "5", false],
          ].map(([k, v, hot]) => (
            <div key={k as string}>
              <div className="font-mono-tech text-[0.55rem] tracking-[0.14em] text-text-faint">
                {k}
              </div>
              <div
                className={`font-display text-sm font-semibold ${
                  hot ? "text-orange-bright" : "text-text"
                }`}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "event",
    top: "47%",
    left: "50%",
    anchor: { x: 51, y: 50 },
    delay: 1.18,
    content: (
      <>
        <div className="flex items-center justify-between font-mono-tech text-[0.6rem] text-text-faint">
          <span>03:42</span>
          <span className="text-orange">Q3</span>
        </div>
        <div className="mt-2 font-display text-base font-semibold uppercase tracking-tight text-orange-bright">
          3PT MADE
        </div>
        <div className="mt-1 font-mono-tech text-[0.6rem] text-text-muted">
          PLAYER #23 · 24 FT
        </div>
      </>
    ),
  },
  {
    id: "possession",
    top: "22%",
    left: "82%",
    anchor: { x: 84, y: 25 },
    delay: 1.34,
    content: (
      <>
        <div className="font-mono-tech text-[0.58rem] tracking-[0.18em] text-text-faint">
          POSSESSION
        </div>
        <div className="mt-1 font-display text-2xl font-semibold text-gradient-orange">
          07
        </div>
      </>
    ),
  },
  {
    id: "qa",
    top: "62%",
    left: "75%",
    anchor: { x: 77, y: 64 },
    delay: 1.5,
    content: (
      <>
        <div className="font-mono-tech text-[0.58rem] tracking-[0.18em] text-text-faint">
          QA CONFIDENCE
        </div>
        <div className="mt-1 font-display text-xl font-semibold text-text">
          98.7<span className="text-orange">%</span>
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-surface-light">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-orange-deep via-orange to-orange-bright"
            initial={{ width: 0 }}
            animate={{ width: "98.7%" }}
            transition={{ duration: 1.3, delay: 1.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </>
    ),
  },
];

const CENTER = { x: 68, y: 40 };

export default function BasketballHUD() {
  const reduced = useReducedMotion();

  return (
    <div
      className="pointer-events-none absolute inset-0 hidden select-none lg:block"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hud-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,106,0,0.05)" />
            <stop offset="55%" stopColor="rgba(255,139,61,0.45)" />
            <stop offset="100%" stopColor="rgba(255,106,0,0.08)" />
          </linearGradient>
        </defs>
        {cards.map((c) => (
          <motion.line
            key={c.id}
            x1={c.anchor.x}
            y1={c.anchor.y}
            x2={CENTER.x}
            y2={CENTER.y}
            stroke="url(#hud-line)"
            strokeWidth={0.09}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              duration: reduced ? 0 : 1.3,
              delay: reduced ? 0 : c.delay + 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
        {cards.map((c) => (
          <motion.circle
            key={`${c.id}-dot`}
            cx={c.anchor.x}
            cy={c.anchor.y}
            r={0.32}
            fill="var(--orange)"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: reduced ? 0 : 0.5,
              delay: reduced ? 0 : c.delay + 0.5,
            }}
          />
        ))}
      </svg>

      {cards.map((c) => (
        <motion.div
          key={c.id}
          className="hs-panel sheen-top absolute w-[166px] px-3.5 py-3 backdrop-blur-md"
          style={{ top: c.top, left: c.left }}
          initial={{ opacity: 0, y: reduced ? 0 : 14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: reduced ? 0 : 0.85,
            delay: reduced ? 0 : c.delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {c.content}
        </motion.div>
      ))}
    </div>
  );
}
