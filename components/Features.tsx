"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

const FEATURES = [
  {
    id: "01",
    title: "VIDEO ANNOTATION",
    desc: "Turn game footage into structured basketball events.",
    detail: "Frame-accurate labeling of shots, passes, screens and rotations.",
  },
  {
    id: "02",
    title: "SPORTS DATA QA",
    desc: "Catch inconsistencies and improve data reliability.",
    detail: "Automated cross-checks flag every event below confidence threshold.",
  },
  {
    id: "03",
    title: "PLAYER & GAME TRACKING",
    desc: "Track players, events, possessions and game moments.",
    detail: "Per-player timelines stitched across every possession of the game.",
  },
  {
    id: "04",
    title: "BASKETBALL-FIRST WORKFLOW",
    desc: "Built specifically around the structure of basketball.",
    detail: "A data model shaped by possessions — not generic video tooling.",
  },
];

export default function Features() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden bg-surface py-28 md:py-40">
      <div
        className="bloom absolute -right-32 bottom-0 h-[30rem] w-[30rem]"
        style={{ background: "rgba(255,106,0,0.07)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10">
        <div className="mb-16 md:mb-24">
          <span className="hs-chip mb-6">CAPABILITIES</span>
          <h2 className="display-xl uppercase">
            <span className="text-gradient">Built for </span>
            <span className="text-gradient-orange">the game.</span>
          </h2>
        </div>

        <div ref={ref} className="border-t border-border">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 26 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: i * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              onMouseEnter={() => setHovered(f.id)}
              onMouseLeave={() => setHovered(null)}
              className="group relative border-b border-border"
            >
              <motion.span
                className="pointer-events-none absolute inset-0 -z-0"
                animate={{
                  opacity: hovered === f.id ? 1 : 0,
                }}
                transition={{ duration: 0.45 }}
                style={{ background: "var(--grad-orange-soft)" }}
              />
              <span
                className={`pointer-events-none absolute bottom-0 left-0 h-px origin-left transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  hovered === f.id ? "scale-x-100" : "scale-x-0"
                }`}
                style={{ width: "100%", background: "var(--grad-orange)" }}
              />

              <div className="relative grid grid-cols-1 items-baseline gap-3 px-2 py-8 md:grid-cols-[80px_1fr_1fr] md:gap-8 md:px-4 md:py-12">
                <span
                  className={`font-mono-tech text-sm transition-colors duration-400 ${
                    hovered === f.id ? "text-orange" : "text-text-faint"
                  }`}
                >
                  {f.id}
                </span>

                <h3 className="font-display text-2xl font-semibold uppercase tracking-tight transition-colors duration-400 group-hover:text-orange-bright md:text-[2.1rem]">
                  {f.title}
                </h3>

                <div className="max-w-md">
                  <p className="text-sm leading-relaxed text-text-muted md:text-base">
                    {f.desc}
                  </p>
                  <AnimatePresence>
                    {hovered === f.id && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden font-mono-tech text-[0.7rem] leading-relaxed tracking-wide text-orange-bright/80"
                      >
                        <span className="block pt-2">{f.detail}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
