"use client";

import type { AnnotationEvent, EventType } from "@/lib/portal/events";
import type { AnnotationKind } from "@/lib/portal/store";
import type { VideoSegment } from "@/lib/portal/segments";

type Row = {
  label: string;
  types: readonly EventType[];
  /** Made/missed color-codes the marker (shots, box outs) instead of a
   * single flat color for the whole row. */
  madeColored?: boolean;
  color: string;
};

const TRADITIONAL_ROWS: Row[] = [
  { label: "Shots", types: ["two_point", "three_point", "free_throw"], madeColored: true, color: "var(--orange)" },
  { label: "Rebounds", types: ["offensive_rebound", "defensive_rebound"], color: "#7cd48a" },
  { label: "Assists", types: ["assist"], color: "#5ec8e6" },
  { label: "Blocks", types: ["block"], color: "#8a7cff" },
  { label: "Steals", types: ["steal"], color: "#d4e05e" },
  { label: "Fouls", types: ["foul", "offensive_foul", "defensive_foul", "technical_foul"], color: "#ff9b9b" },
  { label: "Turnovers", types: ["turnover"], color: "#ffb454" },
  { label: "Other", types: ["substitution_in", "substitution_out", "timeout", "custom"], color: "var(--text-faint)" },
];

const HEART_STATS_ROWS: Row[] = [
  { label: "Deflections", types: ["deflection"], color: "#5ec8e6" },
  { label: "Loose Balls", types: ["loose_ball_recovered"], color: "#7cd48a" },
  { label: "Charges", types: ["charge_drawn"], color: "#ff9b9b" },
  { label: "Screen Ast", types: ["screen_assist"], color: "#8a7cff" },
  { label: "Contested", types: ["contested_shot"], color: "#d4e05e" },
  { label: "Box Outs", types: ["box_out"], madeColored: true, color: "var(--orange)" },
  { label: "Screens", types: ["screen"], madeColored: true, color: "#ffb454" },
  { label: "Blow Bys", types: ["blown_by"], color: "#ff6b6b" },
  { label: "Other", types: ["custom"], color: "var(--text-faint)" },
];

function tickColor(evt: AnnotationEvent, row: Row): string {
  if (!row.madeColored) return row.color;
  return evt.made ? row.color : "rgba(245,242,234,0.35)";
}

export default function EventsTimeline({
  durationSeconds,
  events,
  onSeek,
  segments,
  kind = "traditional",
}: {
  durationSeconds: number;
  events: AnnotationEvent[];
  onSeek: (seconds: number) => void;
  segments?: VideoSegment[] | null;
  kind?: AnnotationKind;
}) {
  const rows = kind === "heart_stats" ? HEART_STATS_ROWS : TRADITIONAL_ROWS;

  return (
    <div className="hs-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">EVENTS TIMELINE</p>
        <span
          title="Every tagged event, grouped by type. Click a marker to jump to that moment."
          className="flex h-4 w-4 flex-none items-center justify-center rounded-full border border-border-strong font-mono-tech text-[0.52rem] text-text-faint"
        >
          i
        </span>
      </div>
      <div className="flex gap-3">
        <div className="flex flex-none flex-col gap-1.5" style={{ width: 76 }}>
          {rows.map((row) => (
            <p
              key={row.label}
              className="flex h-6 items-center font-mono-tech text-[0.56rem] tracking-[0.06em] text-text-faint"
            >
              {row.label.toUpperCase()}
            </p>
          ))}
        </div>

        <div className="relative flex flex-1 flex-col gap-1.5">
          {durationSeconds > 0 &&
            segments &&
            segments.slice(0, -1).map((seg) => (
              <div
                key={`boundary-${seg.label}`}
                className="pointer-events-none absolute inset-y-0 w-px bg-border-strong"
                style={{ left: `${Math.min(100, Math.max(0, (seg.endSeconds / durationSeconds) * 100))}%` }}
                title={`End of ${seg.label}`}
              />
            ))}

          {rows.map((row) => {
            const rowEvents = events.filter((evt) => row.types.includes(evt.eventType));
            return (
              <div key={row.label} className="relative h-6 rounded-md border border-border bg-surface">
                {durationSeconds > 0 &&
                  rowEvents.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => onSeek(evt.timestampSeconds)}
                      title={`${evt.eventType} @ ${evt.timestampSeconds.toFixed(1)}s`}
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background/40 transition-transform hover:scale-150"
                      style={{
                        left: `${Math.min(100, Math.max(0, (evt.timestampSeconds / durationSeconds) * 100))}%`,
                        background: tickColor(evt, row),
                      }}
                      aria-label={`Seek to ${evt.eventType} event`}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
