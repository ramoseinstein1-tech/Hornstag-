"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useCountUp } from "@/lib/useCountUp";

const STATS = [
  { value: 94, suffix: "", label: "ANNOTATED GAMES", note: "2024–25 SEASON" },
  { value: 12481, suffix: "", label: "PLAYER EVENTS", note: "ACROSS ALL GAMES" },
  { value: 98.7, suffix: "%", label: "QA ACCURACY", decimal: true, note: "VERIFIED SAMPLE" },
  { value: 32904, suffix: "", label: "SHOT ATTEMPTS", note: "SPATIALLY TAGGED" },
];

function formatNumber(n: number, decimal?: boolean) {
  if (decimal) return n.toFixed(1);
  return n.toLocaleString("en-US");
}

function Stat({
  value,
  suffix,
  label,
  note,
  decimal,
  active,
  duration,
}: {
  value: number;
  suffix: string;
  label: string;
  note: string;
  decimal?: boolean;
  active: boolean;
  duration: number;
}) {
  const scaled = decimal ? Math.round(value * 10) : Math.round(value);
  const raw = useCountUp(scaled, active, duration);
  const display = decimal ? raw / 10 : raw;

  return (
    <div className="group relative flex flex-col gap-3 px-0 py-8 md:px-8 md:py-2">
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-border md:block">
        <motion.div
          className="h-full w-full origin-top bg-gradient-to-b from-orange to-transparent"
          initial={{ scaleY: 0 }}
          animate={active ? { scaleY: 1 } : {}}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="font-display text-4xl font-bold tabular-nums tracking-tight md:text-[3.4rem]">
        <span className="text-gradient-orange">
          {formatNumber(display, decimal)}
          {suffix}
        </span>
      </div>
      <div>
        <div className="font-mono-tech text-[0.68rem] tracking-[0.2em] text-text-soft">
          {label}
        </div>
        <div className="mt-1.5 font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">
          {note}
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px -15% 0px" });
  const reduced = useReducedMotion();

  return (
    <section
      id="analytics"
      className="relative overflow-hidden bg-surface py-28 md:py-40"
    >
      <div className="grid-bg absolute inset-0 opacity-30" aria-hidden="true" />
      <div
        className="bloom absolute left-1/2 top-0 h-[30rem] w-[40rem] -translate-x-1/2"
        style={{ background: "rgba(255,106,0,0.06)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10">
        <div className="mb-16 max-w-3xl md:mb-24">
          <span className="hs-chip mb-6">ANALYTICS</span>
          <h2 className="display-lg uppercase">
            <span className="text-gradient">Every player. Every possession. </span>
            <span className="text-gradient-orange">Every event.</span>
          </h2>
        </div>

        <div
          ref={ref}
          className="grid grid-cols-1 divide-y divide-border md:grid-cols-4 md:divide-y-0"
        >
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: reduced ? 0 : i * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Stat
                value={s.value}
                suffix={s.suffix}
                label={s.label}
                note={s.note}
                decimal={s.decimal}
                active={inView}
                duration={reduced ? 1 : 1900}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
