"use client";

import { motion } from "framer-motion";
import { CourtBackground, COURT_W, COURT_H } from "@/components/annotator-portal/CourtDiagram";
import type { ShotChartPoint } from "@/lib/portal/store";

/** Read-only shot chart — plots every tagged shot's court location (made
 * orange, missed faint red) on the same court geometry the annotator uses
 * to tag it, via the shared CourtBackground. Each shot pops in with a
 * staggered scale-in on mount rather than appearing all at once — makes
 * even a dense chart read as a reveal instead of a static dump of dots. */
export default function ShotChart({ shots }: { shots: ShotChartPoint[] }) {
  return (
    <svg
      viewBox={`0 0 ${COURT_W} ${COURT_H}`}
      className="w-full rounded-md border border-border"
      style={{
        background:
          "radial-gradient(120% 140% at 50% 50%, rgba(255,106,0,0.06), transparent 60%), var(--surface)",
      }}
      role="img"
      aria-label="Shot chart"
    >
      <CourtBackground />
      {shots.map((s, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: Math.min(i * 0.025, 0.9), ease: [0.16, 1, 0.3, 1] }}
          style={{ x: s.x * COURT_W, y: s.y * COURT_H }}
        >
          <circle
            r={9}
            fill={s.made ? "rgba(255,106,0,0.22)" : "rgba(255,107,107,0.14)"}
            stroke={s.made ? "var(--orange-bright)" : "rgba(255,107,107,0.6)"}
            strokeWidth={2}
          />
          {s.made && <circle r={2.5} fill="var(--orange-bright)" />}
        </motion.g>
      ))}
    </svg>
  );
}
