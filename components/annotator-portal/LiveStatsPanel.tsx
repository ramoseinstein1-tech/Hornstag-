"use client";

import type { Project, RosterPlayer } from "@/lib/portal/store";
import { computeLiveStats, computePlayingTimeSeconds, type AnnotationEvent, type TeamSide } from "@/lib/portal/events";
import { computeHeartStatsBoxScore } from "@/lib/portal/results";
import { formatClockMMSS, type VideoSegment } from "@/lib/portal/segments";

const COLUMNS: { key: "pts" | "reb" | "ast" | "stl" | "blk" | "tov" | "pf"; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "pf", label: "PF" },
];

function TeamTable({
  label,
  roster,
  events,
  segments,
  teamSide,
}: {
  label: string;
  roster: RosterPlayer[];
  events: AnnotationEvent[];
  segments: VideoSegment[] | null;
  teamSide: TeamSide;
}) {
  const stats = computeLiveStats(events, teamSide);
  const byPlayer = new Map(stats.map((s) => [s.playerId, s]));
  const playingTime = computePlayingTimeSeconds(events, segments ?? [], teamSide);
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
              <th className="px-3 py-2.5 text-center font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">MIN</th>
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
                <td colSpan={COLUMNS.length + 2} className="px-5 py-6 text-center text-text-faint">
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
                  <td className="px-3 py-2.5 text-center tabular-nums text-text-muted">
                    {formatClockMMSS(playingTime.get(p.id) ?? 0)}
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

const HEART_COLUMNS: { key: "deflections" | "looseBallsRecovered" | "chargesDrawn" | "screenAssists" | "contestedShots" | "blowBysAllowed"; label: string }[] = [
  { key: "deflections", label: "DEFL" },
  { key: "looseBallsRecovered", label: "LOOSE BALLS" },
  { key: "chargesDrawn", label: "CHARGES" },
  { key: "screenAssists", label: "SCREEN AST" },
  { key: "contestedShots", label: "CONTESTED" },
  { key: "blowBysAllowed", label: "BLOWN BY" },
];

function HeartStatsTeamTable({
  label,
  roster,
  events,
  teamSide,
}: {
  label: string;
  roster: RosterPlayer[];
  events: AnnotationEvent[];
  teamSide: TeamSide;
}) {
  const stats = computeHeartStatsBoxScore(roster, events, teamSide);
  const byPlayer = new Map(stats.map((s, i) => [roster[i]?.id, s]));
  const totalDeflections = stats.reduce((sum, s) => sum + s.deflections, 0);

  return (
    <div className="hs-panel sheen-top overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="font-mono-tech text-[0.62rem] tracking-[0.16em] text-text-soft">{label}</p>
        <p className="font-display text-lg font-semibold text-orange-bright">{totalDeflections} DEFL</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-2.5 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">PLAYER</th>
              {HEART_COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2.5 text-center font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">BOX OUTS</th>
              <th className="px-3 py-2.5 text-center font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">SCREENS</th>
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 && (
              <tr>
                <td colSpan={HEART_COLUMNS.length + 3} className="px-5 py-6 text-center text-text-faint">
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
                  {HEART_COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-center tabular-nums text-text-muted">
                      {s ? s[c.key] : 0}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center tabular-nums text-text-muted">
                    {s ? `${s.boxOutsWon}/${s.boxOutsAttempted}` : "0/0"}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-text-muted">
                    {s ? `${s.screensGood}/${s.screensAttempted}` : "0/0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LiveStatsPanel({
  project,
  events,
  segments,
}: {
  project: Project;
  events: AnnotationEvent[];
  segments: VideoSegment[] | null;
}) {
  const isHeartStats = project.annotationKind === "heart_stats";

  return (
    <div className="flex flex-col gap-6">
      {isHeartStats ? (
        <>
          <HeartStatsTeamTable label="MY TEAM — LIVE" roster={project.roster} events={events} teamSide="team" />
          {project.scope === "Both Teams" && (
            <HeartStatsTeamTable
              label="OPPOSITION — LIVE"
              roster={project.opponentRoster ?? []}
              events={events}
              teamSide="opponent"
            />
          )}
        </>
      ) : (
        <>
          <TeamTable label="MY TEAM — LIVE" roster={project.roster} events={events} segments={segments} teamSide="team" />
          {project.scope === "Both Teams" && (
            <TeamTable
              label="OPPOSITION — LIVE"
              roster={project.opponentRoster ?? []}
              events={events}
              segments={segments}
              teamSide="opponent"
            />
          )}
        </>
      )}
    </div>
  );
}
