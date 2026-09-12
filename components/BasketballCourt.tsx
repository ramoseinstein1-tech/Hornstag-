"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, useInView } from "framer-motion";

const CourtScene = dynamic(() => import("./CourtScene"), { ssr: false });

const LEGEND = [
  { label: "ACTIVE PLAYER", tone: "bg-orange" },
  { label: "TRACKED POSITION", tone: "bg-orange-deep" },
  { label: "COURT GEOMETRY", tone: "bg-text-faint" },
];

export default function BasketballCourt() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { margin: "-10% 0px -10% 0px" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (inView) setMounted(true);
  }, [inView]);

  return (
    <section
      id="platform"
      ref={containerRef}
      className="relative overflow-hidden py-28 md:py-40"
    >
      <div
        className="bloom absolute right-0 top-1/4 h-[34rem] w-[34rem]"
        style={{ background: "rgba(255,106,0,0.07)" }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10">
        <div className="mb-14 flex flex-col justify-between gap-8 md:mb-20 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="hs-chip mb-6">PLATFORM</span>
            <h2 className="display-lg uppercase">
              <span className="text-gradient">A tactical view of </span>
              <span className="text-gradient-orange">every possession.</span>
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-text-muted">
              Hover a marker to inspect live player data extracted directly from
              game film.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {LEGEND.map((l) => (
              <li
                key={l.label}
                className="flex items-center gap-3 font-mono-tech text-[0.62rem] tracking-[0.16em] text-text-faint"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${l.tone}`} />
                {l.label}
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="hs-panel sheen-top relative aspect-[4/3] w-full overflow-hidden md:aspect-[16/9]"
        >
          <div className="grid-bg-fine absolute inset-0 opacity-30" />
          {mounted && <CourtScene />}

          <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-2">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-orange" />
            <span className="font-mono-tech text-[0.6rem] tracking-[0.2em] text-text-muted">
              LIVE TRACKING
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-5 right-5 font-mono-tech text-[0.6rem] tracking-[0.2em] text-text-faint">
            HALF COURT / 5 TRACKED
          </div>
        </motion.div>
      </div>
    </section>
  );
}
