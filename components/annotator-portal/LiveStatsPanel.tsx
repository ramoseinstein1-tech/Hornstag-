"use client";

import type { Project, RosterPlayer } from "@/lib/portal/store";
import { computeLiveStats, type AnnotationEvent, type TeamSide } from "@/lib/portal/events";

const COLUMNS: { key: "pts" | "reb" | "ast" | "stl" | "blk" | "tov" | "pf"; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "pf", label: "PF" },
];

function TeamTable({ label, roster, events, teamSide }: { label: string; roster: RosterPlayer[]; events: AnnotationEvent[]; teamSide: TeamSide }) {
  const stats = computeLiveStats(events, teamSide);
  const byPlayer = new Map(stats.map((s) => [s.playerId, s]));
  const totals = COLUMNS.reduce<Record<string, number>>((acc, col) => {
    acc[col.key] = stats.reduce((sum, s) => sum + s[col.key], 0);
    return acc;
  }, {});

  return (
    <div className="hs-panel sheen-top overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="font-mono-tech text-[0.62rem] tracking-[0.16em] text-text-soft">{label}</p>
        <p className="font-display text-lg font-semibold text-orange-bright">{totals.pts ?? 0} PTS</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-2.5 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">PLAYER</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2.5 text-center font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-5 py-6 text-center text-text-faint">
                  No roster yet.
                </td>
              </tr>
            )}
            {roster.map((p) => {
              const s = byPlayer.get(p.id);
              return (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-5 py-2.5 text-text">
                    #{p.number} {p.name}
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-center tabular-nums text-text-muted">
                      {s ? s[c.key] : 0}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LiveStatsPanel({ project, events }: { project: Project; events: AnnotationEvent[] }) {
  return (
    <div className="flex flex-col gap-6">
      <TeamTable label="MY TEAM — LIVE" roster={project.roster} events={events} teamSide="team" />
      {project.scope === "Both Teams" && (
        <TeamTable label="OPPOSITION — LIVE" roster={project.opponentRoster ?? []} events={events} teamSide="opponent" />
      )}
    </div>
  );
}
