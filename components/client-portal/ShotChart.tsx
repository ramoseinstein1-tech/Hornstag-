import { CourtBackground, COURT_W, COURT_H } from "@/components/annotator-portal/CourtDiagram";
import type { ShotChartPoint } from "@/lib/portal/store";

/** Read-only shot chart — plots every tagged shot's court location (made
 * green, missed faint red) on the same court geometry the annotator uses
 * to tag it, via the shared CourtBackground. No interactivity. */
export default function ShotChart({ shots }: { shots: ShotChartPoint[] }) {
  return (
    <svg
      viewBox={`0 0 ${COURT_W} ${COURT_H}`}
      className="w-full rounded-md border border-border"
      style={{
        background:
          "radial-gradient(120% 140% at 50% 50%, rgba(255,106,0,0.05), transparent 60%), var(--surface)",
      }}
      role="img"
      aria-label="Shot chart"
    >
      <CourtBackground />
      {shots.map((s, i) => (
        <g key={i} transform={`translate(${s.x * COURT_W}, ${s.y * COURT_H})`}>
          <circle
            r={9}
            fill={s.made ? "rgba(124,212,138,0.25)" : "rgba(255,107,107,0.15)"}
            stroke={s.made ? "#7cd48a" : "rgba(255,107,107,0.6)"}
            strokeWidth={2}
          />
        </g>
      ))}
    </svg>
  );
}
