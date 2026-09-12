"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const SHOTS = [
  { x: 50, y: 18, made: true },
  { x: 30, y: 30, made: false },
  { x: 70, y: 32, made: true },
  { x: 50, y: 42, made: true },
  { x: 20, y: 50, made: false },
  { x: 80, y: 48, made: true },
  { x: 42, y: 58, made: false },
  { x: 60, y: 60, made: true },
  { x: 50, y: 70, made: true },
  { x: 15, y: 68, made: false },
  { x: 85, y: 66, made: true },
  { x: 35, y: 22, made: true },
  { x: 65, y: 20, made: false },
  { x: 50, y: 82, made: true },
];

const EVENTS = [
  { label: "SHOTS", value: 32904, max: 32904 },
  { label: "REBOUNDS", value: 18220, max: 32904 },
  { label: "ASSISTS", value: 9114, max: 32904 },
  { label: "TURNOVERS", value: 5602, max: 32904 },
  { label: "FOULS", value: 4310, max: 32904 },
];

const ZONES = [
  { label: "RESTRICTED", pct: 64 },
  { label: "PAINT", pct: 47 },
  { label: "MID-RANGE", pct: 38 },
  { label: "CORNER 3", pct: 41 },
  { label: "ABOVE BREAK", pct: 35 },
];

function PanelHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h3 className="font-mono-tech text-[0.64rem] tracking-[0.2em] text-text-soft">
        {title}
      </h3>
      {meta && (
        <span className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">
          {meta}
        </span>
      )}
    </div>
  );
}

function ShotChart({ inView }: { inView: boolean }) {
  return (
    <div className="hs-panel sheen-top hs-panel-hover flex flex-col p-6">
      <PanelHeading title="SHOT CHART" meta="14 ATTEMPTS" />
      <svg viewBox="0 0 100 100" className="w-full flex-1">
        <defs>
          <radialGradient id="paint-glow" cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="rgba(255,106,0,0.14)" />
            <stop offset="100%" stopColor="rgba(255,106,0,0)" />
          </radialGradient>
        </defs>
        <rect x="4" y="4" width="92" height="92" rx="1" fill="url(#paint-glow)" />
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="1"
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.5"
        />
        <path
          d="M 12 12 L 12 60 A 38 38 0 0 0 88 60 L 88 12"
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.5"
        />
        <rect
          x="34"
          y="4"
          width="32"
          height="34"
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.5"
        />
        <circle
          cx="50"
          cy="38"
          r="10"
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.5"
        />
        {SHOTS.map((s, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{
              duration: 0.5,
              delay: 0.04 * i,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ transformOrigin: `${s.x}px ${s.y}px` }}
          >
            {s.made && (
              <circle cx={s.x} cy={s.y} r={4} fill="rgba(255,106,0,0.18)" />
            )}
            <circle
              cx={s.x}
              cy={s.y}
              r={s.made ? 2 : 1.7}
              fill={s.made ? "var(--orange)" : "transparent"}
              stroke={s.made ? "none" : "var(--text-faint)"}
              strokeWidth="0.6"
            />
          </motion.g>
        ))}
      </svg>
      <div className="mt-5 flex gap-5 font-mono-tech text-[0.62rem] text-text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange" /> MADE
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-text-faint" /> MISS
        </span>
      </div>
    </div>
  );
}

function EventDistribution({ inView }: { inView: boolean }) {
  return (
    <div className="hs-panel sheen-top hs-panel-hover flex flex-col p-6">
      <PanelHeading title="EVENT DISTRIBUTION" meta="SEASON TOTAL" />
      <div className="flex flex-1 flex-col justify-between gap-5 pb-1">
        {EVENTS.map((e, i) => (
          <div key={e.label}>
            <div className="mb-2 flex justify-between font-mono-tech text-[0.64rem]">
              <span className="tracking-[0.12em] text-text-muted">{e.label}</span>
              <span className="tabular-nums text-text">
                {e.value.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-light">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--grad-orange)" }}
                initial={{ width: 0 }}
                animate={inView ? { width: `${(e.value / e.max) * 100}%` } : {}}
                transition={{
                  duration: 1,
                  delay: 0.1 * i,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShotZones({ inView }: { inView: boolean }) {
  return (
    <div className="hs-panel sheen-top hs-panel-hover flex flex-col p-6">
      <PanelHeading title="SHOT ZONES" meta="FG%" />
      <div className="flex min-h-[186px] flex-1 items-end justify-between gap-3 pb-1">
        {ZONES.map((z, i) => (
          <div key={z.label} className="flex flex-1 flex-col items-center gap-3">
            <span className="font-mono-tech text-[0.62rem] tabular-nums text-orange-bright">
              {z.pct}%
            </span>
            <motion.div
              className="w-full rounded-t-sm"
              style={{
                background:
                  "linear-gradient(180deg, var(--orange-bright), rgba(255,106,0,0.12))",
              }}
              initial={{ height: 0 }}
              animate={inView ? { height: `${z.pct * 1.9}px` } : {}}
              transition={{
                duration: 0.9,
                delay: 0.08 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
            <span className="text-center font-mono-tech text-[0.54rem] leading-tight tracking-[0.1em] text-text-faint">
              {z.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PossessionStrip({ inView }: { inView: boolean }) {
  const [segments, setSegments] = useState<{ team: boolean; width: number }[]>(
    []
  );

  useEffect(() => {
    setSegments(
      Array.from({ length: 28 }, () => ({
        team: Math.random() > 0.5,
        width: 2 + Math.random() * 4,
      }))
    );
  }, []);

  return (
    <div className="hs-panel sheen-top p-6 md:col-span-2 lg:col-span-3">
      <PanelHeading title="POSSESSION TIMELINE" meta="FULL GAME" />
      <div className="flex h-8 w-full gap-px overflow-hidden rounded-sm">
        {segments.map((s, i) => (
          <motion.div
            key={i}
            className="rounded-[1px]"
            style={{
              width: `${s.width}%`,
              background: s.team
                ? "linear-gradient(180deg, var(--orange-bright), var(--orange-deep))"
                : "var(--surface-light)",
            }}
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{
              duration: 0.5,
              delay: 0.02 * i,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-between font-mono-tech text-[0.6rem] tracking-[0.14em] text-text-faint">
        <span>Q1 00:00</span>
        <span className="text-text-muted">28 POSSESSIONS</span>
        <span>Q4 12:00</span>
      </div>
    </div>
  );
}

export default function DataVisualization() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px -15% 0px" });

  return (
    <section className="relative py-28 md:py-40">
      <div className="mx-auto max-w-[1440px] px-6 md:px-10">
        <div className="mb-16 max-w-2xl md:mb-20">
          <span className="hs-chip mb-6">DATA VISUALIZATION</span>
          <h2 className="display-lg uppercase">
            <span className="text-gradient">The game, </span>
            <span className="text-gradient-orange">rendered as data.</span>
          </h2>
        </div>

        <div
          ref={ref}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          <ShotChart inView={inView} />
          <EventDistribution inView={inView} />
          <ShotZones inView={inView} />
          <PossessionStrip inView={inView} />
        </div>
      </div>
    </section>
  );
}
