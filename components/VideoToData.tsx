"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useInView } from "framer-motion";

const STAGES = [
  {
    id: "01",
    label: "GAME FILM",
    desc: "Raw broadcast or sideline footage ingested at full resolution.",
    meta: "INGEST",
  },
  {
    id: "02",
    label: "VIDEO ANALYSIS",
    desc: "Frame-level computer vision detects players, ball and court geometry.",
    meta: "VISION",
  },
  {
    id: "03",
    label: "EVENT ANNOTATION",
    desc: "Possessions, shots and actions are labeled into discrete events.",
    meta: "LABEL",
  },
  {
    id: "04",
    label: "QUALITY ASSURANCE",
    desc: "Every event is cross-checked against confidence thresholds.",
    meta: "VERIFY",
  },
  {
    id: "05",
    label: "STRUCTURED DATA",
    desc: "Events are normalized into a clean, queryable data model.",
    meta: "MODEL",
  },
  {
    id: "06",
    label: "GAME INSIGHTS",
    desc: "Structured data becomes reports, dashboards and decisions.",
    meta: "DELIVER",
  },
];

function Stage({
  id,
  label,
  desc,
  meta,
}: {
  id: string;
  label: string;
  desc: string;
  meta: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-42% 0px -42% 0px" });

  return (
    <div ref={ref} className="relative flex gap-6 py-7 md:gap-10 md:py-9">
      <div className="relative flex w-12 flex-none justify-center md:w-16">
        <motion.div
          className="relative z-10 flex h-12 w-12 items-center justify-center rounded-md border font-mono-tech text-xs backdrop-blur-md md:h-16 md:w-16 md:text-sm"
          animate={{
            borderColor: inView ? "var(--border-orange)" : "var(--border)",
            color: inView ? "var(--orange-bright)" : "var(--text-faint)",
            backgroundColor: inView
              ? "rgba(255,106,0,0.08)"
              : "rgba(247,244,236,0.02)",
            boxShadow: inView
              ? "0 0 32px -6px rgba(255,106,0,0.45)"
              : "0 0 0 rgba(0,0,0,0)",
          }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {id}
        </motion.div>
      </div>

      <motion.div
        animate={{ opacity: inView ? 1 : 0.4, x: inView ? 0 : -6 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 pt-1"
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="font-display text-xl font-semibold tracking-tight md:text-3xl">
            {label}
          </h3>
          <motion.span
            className="font-mono-tech text-[0.6rem] tracking-[0.2em]"
            animate={{ color: inView ? "var(--orange)" : "var(--text-faint)" }}
            transition={{ duration: 0.5 }}
          >
            {meta}
          </motion.span>
        </div>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted md:text-base">
          {desc}
        </p>
      </motion.div>
    </div>
  );
}

export default function VideoToData() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.75", "end 0.4"],
  });
  const lineScale = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 24,
    restDelta: 0.001,
  });

  return (
    <section
      id="workflow"
      ref={sectionRef}
      className="relative py-28 md:py-40"
    >
      <div className="mx-auto max-w-[1440px] px-6 md:px-10">
        <div className="mb-16 max-w-2xl md:mb-24">
          <span className="hs-chip mb-6">WORKFLOW</span>
          <h2 className="display-lg uppercase">
            <span className="text-gradient">From video to </span>
            <span className="text-gradient-orange">structured data.</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-text-muted">
            Six stages take a raw game file and turn it into a verified,
            queryable record of everything that happened on the floor.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-6 top-0 h-full w-px bg-border md:left-8" />
          <motion.div
            className="absolute left-6 top-0 h-full w-px origin-top md:left-8"
            style={{
              scaleY: lineScale,
              background:
                "linear-gradient(180deg, var(--orange-bright), var(--orange) 55%, var(--orange-deep))",
              boxShadow: "0 0 18px rgba(255,106,0,0.6)",
            }}
          />
          {STAGES.map((s) => (
            <Stage key={s.id} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
