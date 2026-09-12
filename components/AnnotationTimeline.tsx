"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type GameEvent = {
  time: string;
  label: string;
  player: string;
  quarter: string;
  meta: { label: string; value: string }[];
  confidence: number;
};

const EVENTS: GameEvent[] = [
  {
    time: "00:32",
    label: "SHOT ATTEMPT",
    player: "PLAYER #07",
    quarter: "Q1",
    meta: [
      { label: "DISTANCE", value: "16 FT" },
      { label: "RESULT", value: "MISS" },
      { label: "ZONE", value: "MID-RANGE" },
    ],
    confidence: 97.2,
  },
  {
    time: "01:14",
    label: "REBOUND",
    player: "PLAYER #32",
    quarter: "Q1",
    meta: [
      { label: "TYPE", value: "DEFENSIVE" },
      { label: "LOCATION", value: "PAINT" },
      { label: "CONTEST", value: "YES" },
    ],
    confidence: 99.1,
  },
  {
    time: "02:41",
    label: "3PT MADE",
    player: "PLAYER #23",
    quarter: "Q2",
    meta: [
      { label: "DISTANCE", value: "24 FT" },
      { label: "ASSIST", value: "#11" },
      { label: "ZONE", value: "LEFT WING" },
    ],
    confidence: 98.4,
  },
  {
    time: "03:12",
    label: "FOUL",
    player: "PLAYER #04",
    quarter: "Q2",
    meta: [
      { label: "TYPE", value: "SHOOTING" },
      { label: "COUNT", value: "3RD" },
      { label: "FT AWARDED", value: "2" },
    ],
    confidence: 96.8,
  },
  {
    time: "04:08",
    label: "TURNOVER",
    player: "PLAYER #11",
    quarter: "Q3",
    meta: [
      { label: "TYPE", value: "STEAL" },
      { label: "BY", value: "#04" },
      { label: "TRANSITION", value: "YES" },
    ],
    confidence: 98.9,
  },
  {
    time: "06:19",
    label: "ASSIST",
    player: "PLAYER #11",
    quarter: "Q4",
    meta: [
      { label: "SCORER", value: "#23" },
      { label: "POSSESSION", value: "07" },
      { label: "PASS TYPE", value: "PICK & ROLL" },
    ],
    confidence: 98.4,
  },
];

export default function AnnotationTimeline() {
  const [active, setActive] = useState(2);
  const event = EVENTS[active];

  return (
    <section
      id="annotation"
      className="relative overflow-hidden bg-surface py-28 md:py-40"
    >
      <div
        className="bloom absolute -left-40 top-1/3 h-[30rem] w-[30rem]"
        style={{ background: "rgba(255,106,0,0.08)" }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10">
        <div className="mb-16 flex flex-col justify-between gap-8 md:mb-20 md:flex-row md:items-end">
          <div className="max-w-xl">
            <span className="hs-chip mb-6">ANNOTATION</span>
            <h2 className="display-lg uppercase">
              <span className="text-gradient">Every possession </span>
              <span className="text-gradient-orange">tells a story.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-text-muted md:text-base">
            Select a moment on the timeline to inspect how Hornstag annotates a
            live basketball event.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="hs-panel sheen-top flex flex-col p-6 md:p-8">
            <div className="mb-8 flex items-center justify-between">
              <span className="font-mono-tech text-[0.62rem] tracking-[0.2em] text-text-faint">
                GAME TIMELINE
              </span>
              <span className="font-mono-tech text-[0.62rem] tracking-[0.2em] text-orange">
                {EVENTS.length} EVENTS
              </span>
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="relative min-w-[660px] pt-2">
                <div className="absolute inset-x-0 top-[18px] h-px bg-border" />
                <motion.div
                  className="absolute left-0 top-[18px] h-px bg-gradient-to-r from-orange-deep via-orange to-orange-bright"
                  animate={{
                    width: `${(active / (EVENTS.length - 1)) * 100}%`,
                  }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />

                <div className="relative flex justify-between">
                  {EVENTS.map((e, i) => {
                    const isActive = i === active;
                    const isPast = i < active;
                    return (
                      <button
                        key={e.time}
                        onClick={() => setActive(i)}
                        onMouseEnter={() => setActive(i)}
                        className="group flex flex-1 flex-col items-center gap-4 px-1 focus-visible:outline-none"
                        aria-pressed={isActive}
                        aria-label={`${e.time} ${e.label}`}
                      >
                        <span className="relative flex h-9 w-9 items-center justify-center">
                          {isActive && (
                            <motion.span
                              layoutId="timeline-ring"
                              className="absolute inset-0 rounded-full border border-orange/60"
                              style={{
                                boxShadow: "0 0 22px rgba(255,106,0,0.45)",
                              }}
                              transition={{
                                duration: 0.45,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                            />
                          )}
                          <span
                            className={`h-2.5 w-2.5 rounded-full transition-all duration-400 ${
                              isActive
                                ? "scale-125 bg-orange shadow-[0_0_14px_rgba(255,106,0,0.9)]"
                                : isPast
                                  ? "bg-orange-deep"
                                  : "bg-surface-raised ring-1 ring-border group-hover:bg-orange-deep"
                            }`}
                          />
                        </span>
                        <span
                          className={`font-mono-tech text-[0.66rem] transition-colors duration-300 ${
                            isActive ? "text-orange-bright" : "text-text-faint"
                          }`}
                        >
                          {e.time}
                        </span>
                        <span
                          className={`max-w-[92px] text-center text-[0.66rem] font-medium uppercase leading-tight tracking-wide transition-colors duration-300 ${
                            isActive ? "text-text" : "text-text-muted"
                          }`}
                        >
                          {e.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
              {[
                { k: "SOURCE", v: "BROADCAST 1080P" },
                { k: "ANNOTATOR", v: "AUTO + REVIEW" },
                { k: "EVENTS TAGGED", v: "184" },
                { k: "AVG CONFIDENCE", v: "98.1%" },
              ].map((s) => (
                <div key={s.k}>
                  <div className="font-mono-tech text-[0.58rem] tracking-[0.16em] text-text-faint">
                    {s.k}
                  </div>
                  <div className="mt-1.5 font-mono-tech text-[0.72rem] text-text-soft">
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hs-panel sheen-top relative min-h-[300px] overflow-hidden p-6">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "var(--grad-orange)" }}
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={event.time}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-orange" />
                    <span className="font-mono-tech text-xs text-text-muted">
                      {event.time}
                    </span>
                  </span>
                  <span className="font-mono-tech text-[0.62rem] tracking-[0.18em] text-orange">
                    {event.quarter}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-2xl font-semibold uppercase tracking-tight text-gradient-orange">
                  {event.label}
                </h3>
                <p className="mt-1.5 font-mono-tech text-xs text-text-muted">
                  {event.player}
                </p>

                <div className="mt-6 space-y-3 border-t border-border pt-5">
                  {event.meta.map((m, i) => (
                    <motion.div
                      key={m.label}
                      className="flex items-center justify-between text-xs"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.06 * i + 0.1, duration: 0.4 }}
                    >
                      <span className="font-mono-tech tracking-[0.12em] text-text-faint">
                        {m.label}
                      </span>
                      <span className="font-medium text-text">{m.value}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[0.6rem] tracking-[0.18em] text-text-faint">
                      CONFIDENCE
                    </span>
                    <span className="font-display text-sm font-semibold text-orange-bright">
                      {event.confidence.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-light">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "var(--grad-orange)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${event.confidence}%` }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
