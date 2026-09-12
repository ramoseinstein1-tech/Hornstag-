"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getProjects,
  getProjectResults,
  teamTotals,
  toCsv,
  downloadCsv,
} from "@/lib/portal/store";
import type { PlayerBoxScore, TaggedClip } from "@/lib/portal/store";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="hs-panel sheen-top p-4 text-center">
      <div className="font-display text-xl font-semibold text-orange-bright">{value}</div>
      <div className="mt-1 font-mono-tech text-[0.56rem] tracking-[0.12em] text-text-faint">
        {label}
      </div>
    </div>
  );
}

function BoxScoreTable({ title, players }: { title: string; players: PlayerBoxScore[] }) {
  return (
    <div className="hs-panel sheen-top p-5">
      <h3 className="mb-4 font-mono-tech text-[0.64rem] tracking-[0.18em] text-text-soft">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {["PLAYER", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FG", "3P"].map((h) => (
                <th
                  key={h}
                  className="pb-2 pr-4 font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={`${p.number}-${p.name}`} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-4 text-text">
                  #{p.number} {p.name}
                </td>
                <td className="py-2.5 pr-4 font-mono-tech text-orange-bright">{p.pts}</td>
                <td className="py-2.5 pr-4 font-mono-tech text-text-muted">{p.reb}</td>
                <td className="py-2.5 pr-4 font-mono-tech text-text-muted">{p.ast}</td>
                <td className="py-2.5 pr-4 font-mono-tech text-text-muted">{p.stl}</td>
                <td className="py-2.5 pr-4 font-mono-tech text-text-muted">{p.blk}</td>
                <td className="py-2.5 pr-4 font-mono-tech text-text-muted">{p.tov}</td>
                <td className="py-2.5 pr-4 font-mono-tech text-text-muted">
                  {p.fgm}/{p.fga}
                </td>
                <td className="py-2.5 pr-4 font-mono-tech text-text-muted">
                  {p.tpm}/{p.tpa}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClipCard({ clip }: { clip: TaggedClip }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className="hs-panel sheen-top hs-panel-hover flex flex-col overflow-hidden text-left"
    >
      <div
        className="relative flex h-28 flex-none items-center justify-center"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,106,0,0.16), rgba(255,106,0,0.02))",
        }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-orange/40 bg-background/60 text-orange-bright">
          ▶
        </span>
        <span className="absolute bottom-2 right-2 font-mono-tech text-[0.58rem] tracking-[0.1em] text-text-faint">
          {clip.time}
        </span>
      </div>
      <div className="p-3.5">
        <p className="font-display text-sm font-semibold uppercase tracking-tight text-orange-bright">
          {clip.label}
        </p>
        <p className="mt-1 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-muted">
          {clip.player}
        </p>
        <p className="mt-1 font-mono-tech text-[0.58rem] tracking-[0.1em] text-text-faint">
          {clip.confidence}% CONFIDENCE
        </p>
        {open && (
          <p className="mt-2 border-t border-border pt-2 text-[0.68rem] leading-relaxed text-text-faint">
            Clip playback isn&rsquo;t available in this demo — in production
            this would stream the tagged segment directly from your
            uploaded film.
          </p>
        )}
      </div>
    </button>
  );
}

export default function ResultsPage() {
  const { user } = useAuth();
  const allProjects = useMemo(() => (user ? getProjects(user.id) : []), [user]);
  const [selectedId, setSelectedId] = useState<string | null>(allProjects[0]?.id ?? null);

  const selected = allProjects.find((p) => p.id === selectedId) ?? allProjects[0] ?? null;
  const results = useMemo(
    () => (selected && selected.status !== "Processing" ? getProjectResults(selected) : null),
    [selected]
  );
  const yourTotals = useMemo(() => (results ? teamTotals(results.team) : null), [results]);
  const oppTotals = useMemo(
    () => (results?.opponent ? teamTotals(results.opponent) : null),
    [results]
  );

  function handleDownloadBoxScore() {
    if (!selected || !results) return;
    const rows: (string | number)[][] = [];
    const addRows = (label: string, players: PlayerBoxScore[]) => {
      players.forEach((p) =>
        rows.push([
          label,
          `#${p.number} ${p.name}`,
          p.pts,
          p.reb,
          p.ast,
          p.stl,
          p.blk,
          p.tov,
          `${p.fgm}/${p.fga}`,
          `${p.tpm}/${p.tpa}`,
        ])
      );
    };
    addRows(selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM", results.team);
    if (results.opponent) addRows(selected.opponent ?? "OPPONENT", results.opponent);

    const csv = toCsv(
      ["TEAM", "PLAYER", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FG", "3P"],
      rows
    );
    downloadCsv(`${selected.name.replace(/[^\w-]+/g, "_")}_box_score.csv`, csv);
  }

  function handleDownloadEventLog() {
    if (!selected || !results) return;
    const rows = results.clips.map((c) => [c.time, c.label, c.player, `${c.confidence}%`]);
    const csv = toCsv(["TIME", "EVENT", "PLAYER", "CONFIDENCE"], rows);
    downloadCsv(`${selected.name.replace(/[^\w-]+/g, "_")}_event_log.csv`, csv);
  }

  if (allProjects.length === 0) {
    return (
      <div>
        <p className="eyebrow mb-3">CLIENT PORTAL</p>
        <h1 className="display-md uppercase">
          <span className="text-gradient-orange">Results.</span>
        </h1>
        <div className="hs-panel mt-10 flex flex-col items-center justify-center gap-3 p-14 text-center">
          <p className="text-sm text-text-muted">No projects yet.</p>
          <Link
            href="/client-portal/upload"
            className="font-mono-tech text-[0.66rem] tracking-[0.14em] text-orange-bright transition-colors hover:text-orange"
          >
            UPLOAD YOUR FIRST GAME FILM →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        <p className="eyebrow mb-3">CLIENT PORTAL</p>
        <h1 className="display-md uppercase">
          <span className="text-gradient">Game </span>
          <span className="text-gradient-orange">Results.</span>
        </h1>
        <p className="mt-2 max-w-lg text-sm text-text-muted">
          Team stats, player stats, tagged clips, and downloadable reports
          for each project.
        </p>
      </div>

      <div className="mt-8 max-w-md">
        <label htmlFor="proj-select" className="hs-label">
          SELECT PROJECT
        </label>
        <select
          id="proj-select"
          className="hs-input"
          value={selected?.id}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {allProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.status}
            </option>
          ))}
        </select>
      </div>

      {selected && selected.status === "Processing" && (
        <div
          className="hs-panel mt-8 flex flex-col items-center justify-center gap-3 p-14 text-center"
          style={{ borderStyle: "dashed" }}
        >
          <span className="hs-chip">PROCESSING</span>
          <p className="max-w-sm text-sm text-text-faint">
            Annotation hasn&rsquo;t started on &ldquo;{selected.name}&rdquo;
            yet. Check back once processing begins.
          </p>
        </div>
      )}

      {selected && results && yourTotals && (
        <>
          <div className="mt-10">
            <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
              TEAM STATS
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.14em] text-orange-bright">
                  {selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM"}
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <StatTile label="PTS" value={yourTotals.pts} />
                  <StatTile label="REB" value={yourTotals.reb} />
                  <StatTile label="AST" value={yourTotals.ast} />
                  <StatTile label="FG%" value={`${yourTotals.fgPct}%`} />
                </div>
              </div>

              {oppTotals && (
                <div>
                  <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.14em] text-text-muted">
                    {selected.opponent ?? "OPPONENT"}
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    <StatTile label="PTS" value={oppTotals.pts} />
                    <StatTile label="REB" value={oppTotals.reb} />
                    <StatTile label="AST" value={oppTotals.ast} />
                    <StatTile label="FG%" value={`${oppTotals.fgPct}%`} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-6">
            <h2 className="font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
              PLAYER STATS
            </h2>
            <BoxScoreTable
              title={selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM"}
              players={results.team}
            />
            {results.opponent && (
              <BoxScoreTable title={selected.opponent ?? "OPPONENT"} players={results.opponent} />
            )}
          </div>

          <div className="mt-10">
            <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
              TAGGED CLIPS
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {results.clips.map((c) => (
                <ClipCard key={c.id} clip={c} />
              ))}
            </div>
          </div>

          <div className="mt-10 mb-2">
            <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
              REPORTS
            </h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleDownloadBoxScore} className="hs-btn-secondary">
                DOWNLOAD BOX SCORE (CSV)
              </button>
              <button onClick={handleDownloadEventLog} className="hs-btn-secondary">
                DOWNLOAD EVENT LOG (CSV)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
