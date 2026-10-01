"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getProjects,
  getProjectResults,
  teamTotals,
  toCsv,
  downloadCsv,
} from "@/lib/portal/store";
import type {
  Project,
  PlayerBoxScore,
  PlayerHeartStatsBoxScore,
  ProjectResults,
  HeartStatsResults,
  TaggedClip,
  ProjectStatus,
} from "@/lib/portal/store";
import { computeRealResults, computeRealHeartStatsResults, hasRealAnnotationData } from "@/lib/portal/results";
import { getSegments, getSegmentClipUrl, formatClockMMSS, type VideoSegment } from "@/lib/portal/segments";
import { getVideoIssues, ISSUE_TYPE_LABELS, type VideoIssue } from "@/lib/portal/videoIssues";
import { generateHighlightReel, selectHighlightClips, type HighlightProgress } from "@/lib/portal/highlightReel";
import ShotChart from "@/components/client-portal/ShotChart";
import {
  fgPctOf,
  formatPlusMinus,
  fadeUp,
  Bloom,
  GameScoreHero,
  SectionHeading,
  BoxScoreTable,
} from "@/components/client-portal/ResultsDisplay";

function sumHeartStats(players: PlayerHeartStatsBoxScore[]) {
  return players.reduce(
    (sum, p) => ({
      deflections: sum.deflections + p.deflections,
      looseBallsRecovered: sum.looseBallsRecovered + p.looseBallsRecovered,
      chargesDrawn: sum.chargesDrawn + p.chargesDrawn,
      screenAssists: sum.screenAssists + p.screenAssists,
      contestedShots: sum.contestedShots + p.contestedShots,
      boxOutsWon: sum.boxOutsWon + p.boxOutsWon,
      boxOutsAttempted: sum.boxOutsAttempted + p.boxOutsAttempted,
      screensGood: sum.screensGood + p.screensGood,
      screensAttempted: sum.screensAttempted + p.screensAttempted,
      blowBysAllowed: sum.blowBysAllowed + p.blowBysAllowed,
    }),
    {
      deflections: 0, looseBallsRecovered: 0, chargesDrawn: 0, screenAssists: 0, contestedShots: 0,
      boxOutsWon: 0, boxOutsAttempted: 0, screensGood: 0, screensAttempted: 0, blowBysAllowed: 0,
    }
  );
}

function HeartStatsHero({ project, heartResults }: { project: Project; heartResults: HeartStatsResults }) {
  const yourSum = useMemo(() => sumHeartStats(heartResults.team), [heartResults.team]);
  const oppSum = useMemo(() => (heartResults.opponent ? sumHeartStats(heartResults.opponent) : null), [heartResults.opponent]);
  const tiles: [string, number][] = [
    ["DEFL", yourSum.deflections],
    ["LOOSE BALLS", yourSum.looseBallsRecovered],
    ["CHARGES", yourSum.chargesDrawn],
    ["SCREEN AST", yourSum.screenAssists],
    ["CONTESTED", yourSum.contestedShots],
    ["BOX OUTS", yourSum.boxOutsWon],
    ["GOOD SCREENS", yourSum.screensGood],
    ["BLOWN BY", yourSum.blowBysAllowed],
  ];
  const oppTiles: [string, number][] | null = oppSum
    ? [
        ["DEFL", oppSum.deflections],
        ["LOOSE BALLS", oppSum.looseBallsRecovered],
        ["CHARGES", oppSum.chargesDrawn],
        ["SCREEN AST", oppSum.screenAssists],
        ["CONTESTED", oppSum.contestedShots],
        ["BOX OUTS", oppSum.boxOutsWon],
        ["GOOD SCREENS", oppSum.screensGood],
        ["BLOWN BY", oppSum.blowBysAllowed],
      ]
    : null;

  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="hs-panel sheen-top relative mt-8 overflow-hidden p-6 sm:p-9"
    >
      <Bloom style={{ width: 420, height: 420, top: -200, left: "50%", transform: "translateX(-50%)", opacity: 0.4 }} />
      <div className="relative z-10 flex flex-col items-center gap-3 text-center">
        <span className="hs-chip !border-[#ff6b6b]/40 !text-[#ff9b9b]">HEART STATS</span>
        <h2 className="display-md text-text">{project.name}</h2>
        <p className="max-w-sm text-xs leading-relaxed text-text-faint">
          Hustle/effort plays only — no official score, shot chart, or playing-time tracking applies to this package.
        </p>
      </div>

      <div className="relative z-10 mt-8 flex flex-col gap-6 border-t border-border pt-7">
        <div className="flex flex-col gap-3">
          <p className="font-mono-tech text-[0.6rem] tracking-[0.14em] text-orange-bright">
            {project.scope === "Both Teams" ? "YOUR TEAM TOTALS" : "TEAM TOTALS"}
          </p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            {tiles.map(([l, v]) => (
              <div key={l} className="rounded-md border border-border bg-background/40 p-3 text-center backdrop-blur-sm">
                <div className="font-display text-lg font-semibold tabular-nums text-text">{v}</div>
                <div className="mt-0.5 font-mono-tech text-[0.5rem] tracking-[0.08em] text-text-faint">{l}</div>
              </div>
            ))}
          </div>
        </div>
        {oppTiles && (
          <div className="flex flex-col gap-3">
            <p className="font-mono-tech text-[0.6rem] tracking-[0.14em] text-text-muted">
              {project.opponent ?? "OPPONENT"} TOTALS
            </p>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {oppTiles.map(([l, v]) => (
                <div key={l} className="rounded-md border border-border bg-background/40 p-3 text-center backdrop-blur-sm">
                  <div className="font-display text-lg font-semibold tabular-nums text-text">{v}</div>
                  <div className="mt-0.5 font-mono-tech text-[0.5rem] tracking-[0.08em] text-text-faint">{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function HeartStatsBoxScoreTable({ title, players, accent }: { title: string; players: PlayerHeartStatsBoxScore[]; accent: boolean }) {
  return (
    <div className="hs-panel sheen-top overflow-hidden p-5" style={accent ? { borderColor: "var(--border-orange)" } : undefined}>
      <h3 className={`mb-4 font-mono-tech text-[0.64rem] tracking-[0.18em] ${accent ? "text-orange-bright" : "text-text-soft"}`}>
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {["PLAYER", "DEFL", "LOOSE BALLS", "CHARGES", "SCREEN AST", "CONTESTED", "BOX OUTS", "SCREENS", "BLOWN BY"].map((h) => (
                <th key={h} className="pb-2 pr-4 font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={`${p.number}-${p.name}`} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-light/60">
                <td className="py-2.5 pr-4 text-text">
                  #{p.number} {p.name}
                </td>
                <td className="py-2.5 pr-4 font-mono-tech text-base font-semibold tabular-nums text-orange-bright">{p.deflections}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.looseBallsRecovered}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.chargesDrawn}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.screenAssists}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.contestedShots}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">
                  {p.boxOutsWon}/{p.boxOutsAttempted}
                </td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">
                  {p.screensGood}/{p.screensAttempted}
                </td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.blowBysAllowed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A short preview rather than a precise cut, same "acceptable slack"
// tradeoff already used for the fast, keyframe-based period cutting
// (lib/portal/videoClips.ts) — this just seeks + auto-pauses, no new
// video file involved.
const CLIP_PREVIEW_SECONDS = 6;

function ClipCard({ projectId, clip, index }: { projectId: string; clip: TaggedClip; index: number }) {
  const [open, setOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pauseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && clip.clipPath && !videoUrl && !loading) {
      setLoading(true);
      const signed = await getSegmentClipUrl(projectId, clip.clipPath);
      setLoading(false);
      setVideoUrl(signed);
    }
    if (!next && pauseTimeout.current) {
      clearTimeout(pauseTimeout.current);
    }
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video || clip.clipOffsetSeconds == null) return;
    video.currentTime = clip.clipOffsetSeconds;
    video.play().catch(() => {});
    pauseTimeout.current = setTimeout(() => video.pause(), CLIP_PREVIEW_SECONDS * 1000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
      role="button"
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleToggle()}
      aria-expanded={open}
      className="hs-panel sheen-top hs-panel-hover flex flex-col overflow-hidden text-left"
    >
      <div
        className="relative flex h-28 flex-none items-center justify-center"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,106,0,0.18), rgba(255,106,0,0.02))",
        }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-orange/40 bg-background/60 text-orange-bright shadow-[0_0_24px_-4px_rgba(255,106,0,0.5)]">
          {loading ? "…" : "▶"}
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
        {clip.verified ? (
          <p className="mt-1 font-mono-tech text-[0.58rem] tracking-[0.1em] text-[#7cd48a]">
            ✓ ANNOTATOR VERIFIED
          </p>
        ) : (
          <p className="mt-1 font-mono-tech text-[0.58rem] tracking-[0.1em] text-text-faint">
            {clip.confidence}% CONFIDENCE
          </p>
        )}
        {open && clip.clipPath && videoUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            onLoadedMetadata={handleLoadedMetadata}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 w-full rounded border border-border"
          />
        )}
        {open && !clip.clipPath && (
          <p className="mt-2 border-t border-border pt-2 text-[0.68rem] leading-relaxed text-text-faint">
            No clip available for this event — its period hasn&rsquo;t been
            cut yet, or this event predates video segmentation.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function PeriodClipCard({ projectId, segment, index }: { projectId: string; segment: VideoSegment; index: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    if (url) {
      window.open(url, "_blank", "noopener");
      return;
    }
    if (!segment.clipPath) return;
    setLoading(true);
    const signed = await getSegmentClipUrl(projectId, segment.clipPath);
    setLoading(false);
    if (signed) {
      setUrl(signed);
      window.open(signed, "_blank", "noopener");
    }
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      type="button"
      onClick={handleOpen}
      disabled={loading}
      className="hs-panel sheen-top hs-panel-hover flex items-center justify-between gap-4 p-5 text-left disabled:cursor-wait disabled:opacity-70"
    >
      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-tight text-orange-bright">
          {segment.label}
        </p>
        <p className="mt-1 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-muted">
          {Math.round(segment.endSeconds - segment.startSeconds)}s clip
        </p>
      </div>
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-orange/40 bg-orange/10 text-orange-bright">
        {loading ? "…" : "▶"}
      </span>
    </motion.button>
  );
}

function formatHHMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

const SEVERITY_STYLES: Record<VideoIssue["severity"], string> = {
  low: "text-text-faint",
  medium: "text-orange-bright",
  high: "text-[#ff9b9b]",
};

function VideoIssueCard({ issue }: { issue: VideoIssue }) {
  return (
    <div className="hs-panel sheen-top p-4">
      <p className="text-sm text-text">
        {ISSUE_TYPE_LABELS[issue.issueType]}
        <span className={`ml-2 font-mono-tech text-[0.56rem] tracking-[0.08em] ${SEVERITY_STYLES[issue.severity]}`}>
          {issue.severity.toUpperCase()}
        </span>
      </p>
      {issue.description && (
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{issue.description}</p>
      )}
      <p className="mt-1.5 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
        {issue.reporterName} ({issue.reporterRole})
        {issue.timestampSeconds != null && ` · ${formatHHMMSS(issue.timestampSeconds)}`}
      </p>
    </div>
  );
}

const PENDING_COPY: Record<Exclude<ProjectStatus, "Completed">, { chip: string; message: (project: Project) => string }> = {
  Processing: {
    chip: "PROCESSING",
    message: (p) => `Annotation hasn't started on "${p.name}" yet. Check back once processing begins.`,
  },
  "In Progress": {
    chip: "IN PROGRESS",
    message: (p) => `An annotator is actively tagging "${p.name}". Results appear here once QA approves the submission.`,
  },
  "Needs Review": {
    chip: "IN QA REVIEW",
    message: (p) => `"${p.name}" has been submitted and is awaiting admin QA review before results are released.`,
  },
  Rejected: {
    chip: "REJECTED",
    message: (p) =>
      p.rejectionReason
        ? `"${p.name}" was rejected and won't be annotated: ${p.rejectionReason}`
        : `"${p.name}" was rejected and won't be annotated.`,
  },
};

export default function ResultsPage() {
  const { user } = useAuth();
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<ProjectResults | null>(null);
  const [heartResults, setHeartResults] = useState<HeartStatsResults | null>(null);
  const [periodClips, setPeriodClips] = useState<VideoSegment[]>([]);
  const [videoIssues, setVideoIssues] = useState<VideoIssue[]>([]);
  const [reelUrl, setReelUrl] = useState<string | null>(null);
  const [reelGenerating, setReelGenerating] = useState(false);
  const [reelProgress, setReelProgress] = useState<HighlightProgress | null>(null);
  const [reelError, setReelError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getProjects(user.id).then((projects) => {
      setAllProjects(projects);
      setSelectedId((prev) => prev ?? projects[0]?.id ?? null);
    });
  }, [user]);

  const selected = allProjects.find((p) => p.id === selectedId) ?? allProjects[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setVideoIssues([]);
      return;
    }
    let cancelled = false;
    getVideoIssues(selected.id).then((issues) => {
      if (!cancelled) setVideoIssues(issues);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected || selected.status !== "Completed") {
      setResults(null);
      setHeartResults(null);
      setPeriodClips([]);
      return;
    }
    let cancelled = false;
    if (selected.annotationKind === "heart_stats") {
      setResults(null);
      computeRealHeartStatsResults(selected).then((r) => !cancelled && setHeartResults(r));
    } else {
      setHeartResults(null);
      hasRealAnnotationData(selected.id).then((hasReal) => {
        if (cancelled) return;
        if (hasReal) {
          computeRealResults(selected).then((r) => !cancelled && setResults(r));
        } else {
          setResults(getProjectResults(selected));
        }
      });
    }
    getSegments(selected.id).then((segs) => {
      if (!cancelled) setPeriodClips((segs ?? []).filter((s) => s.clipPath));
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    setReelError(null);
    if (!selected?.highlightReelPath) {
      setReelUrl(null);
      return;
    }
    let cancelled = false;
    getSegmentClipUrl(selected.id, selected.highlightReelPath).then((url) => {
      if (!cancelled) setReelUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function handleGenerateReel() {
    if (!selected || !results) return;
    setReelGenerating(true);
    setReelError(null);
    setReelProgress({ index: 0, total: selectHighlightClips(results.clips).length });

    const result = await generateHighlightReel(selected, results.clips, setReelProgress);

    setReelGenerating(false);
    setReelProgress(null);

    if (!result.ok) {
      setReelError(result.error);
      return;
    }
    setAllProjects((prev) =>
      prev.map((p) =>
        p.id === selected.id
          ? { ...p, highlightReelPath: result.key, highlightReelGeneratedAt: new Date().toISOString() }
          : p
      )
    );
    const url = await getSegmentClipUrl(selected.id, result.key);
    setReelUrl(url);
  }

  const yourTotals = useMemo(() => (results ? teamTotals(results.team) : null), [results]);
  const oppTotals = useMemo(
    () => (results?.opponent ? teamTotals(results.opponent) : null),
    [results]
  );

  const BOX_SCORE_HEADERS = ["TEAM", "PLAYER", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FG", "FG%", "3P", "3P%", "+/-"];

  function boxScoreRows(): (string | number)[][] {
    if (!selected || !results) return [];
    const rows: (string | number)[][] = [];
    const addRows = (label: string, players: PlayerBoxScore[]) => {
      players.forEach((p) =>
        rows.push([
          label,
          `#${p.number} ${p.name}`,
          formatClockMMSS(p.minSeconds),
          p.pts,
          p.reb,
          p.ast,
          p.stl,
          p.blk,
          p.tov,
          `${p.fgm}/${p.fga}`,
          `${fgPctOf(p.fgm, p.fga)}%`,
          `${p.tpm}/${p.tpa}`,
          `${fgPctOf(p.tpm, p.tpa)}%`,
          formatPlusMinus(p.plusMinus),
        ])
      );
    };
    addRows(selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM", results.team);
    if (results.opponent) addRows(selected.opponent ?? "OPPONENT", results.opponent);
    return rows;
  }

  const activeClips: TaggedClip[] = heartResults?.clips ?? results?.clips ?? [];

  const EVENT_LOG_HEADERS = ["TIME", "EVENT", "PLAYER", "CONFIDENCE"];

  function eventLogRows(): (string | number)[][] {
    return activeClips.map((c) => [c.time, c.label, c.player, `${c.confidence}%`]);
  }

  const HEART_STATS_BOX_SCORE_HEADERS = [
    "TEAM", "PLAYER", "DEFL", "LOOSE BALLS", "CHARGES", "SCREEN AST", "CONTESTED",
    "BOX OUTS WON", "BOX OUTS ATTEMPTED", "SCREENS GOOD", "SCREENS ATTEMPTED", "BLOWN BY",
  ];

  function heartStatsBoxScoreRows(): (string | number)[][] {
    if (!selected || !heartResults) return [];
    const rows: (string | number)[][] = [];
    const addRows = (label: string, players: PlayerHeartStatsBoxScore[]) => {
      players.forEach((p) =>
        rows.push([
          label,
          `#${p.number} ${p.name}`,
          p.deflections,
          p.looseBallsRecovered,
          p.chargesDrawn,
          p.screenAssists,
          p.contestedShots,
          p.boxOutsWon,
          p.boxOutsAttempted,
          p.screensGood,
          p.screensAttempted,
          p.blowBysAllowed,
        ])
      );
    };
    addRows(selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM", heartResults.team);
    if (heartResults.opponent) addRows(selected.opponent ?? "OPPONENT", heartResults.opponent);
    return rows;
  }

  function handleDownloadHeartStatsBoxScore() {
    if (!selected) return;
    const csv = toCsv(HEART_STATS_BOX_SCORE_HEADERS, heartStatsBoxScoreRows());
    downloadCsv(`${selected.name.replace(/[^\w-]+/g, "_")}_heart_stats_box_score.csv`, csv);
  }

  const TEAM_STATS_HEADERS = ["TEAM", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FG%", "3P%"];

  function teamStatsRows(): (string | number)[][] {
    if (!selected || !results || !yourTotals) return [];
    const rows: (string | number)[][] = [
      [
        selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM",
        yourTotals.pts,
        yourTotals.reb,
        yourTotals.ast,
        yourTotals.stl,
        yourTotals.blk,
        yourTotals.tov,
        `${yourTotals.fgPct}%`,
        `${yourTotals.tpPct}%`,
      ],
    ];
    if (oppTotals) {
      rows.push([
        selected.opponent ?? "OPPONENT",
        oppTotals.pts,
        oppTotals.reb,
        oppTotals.ast,
        oppTotals.stl,
        oppTotals.blk,
        oppTotals.tov,
        `${oppTotals.fgPct}%`,
        `${oppTotals.tpPct}%`,
      ]);
    }
    return rows;
  }

  function handleDownloadBoxScore() {
    if (!selected) return;
    const csv = toCsv(BOX_SCORE_HEADERS, boxScoreRows());
    downloadCsv(`${selected.name.replace(/[^\w-]+/g, "_")}_box_score.csv`, csv);
  }

  function handleDownloadEventLog() {
    if (!selected) return;
    const csv = toCsv(EVENT_LOG_HEADERS, eventLogRows());
    downloadCsv(`${selected.name.replace(/[^\w-]+/g, "_")}_event_log.csv`, csv);
  }

  function handleDownloadFullReport() {
    if (!selected) return;
    const csv = [
      "TEAM STATS",
      toCsv(TEAM_STATS_HEADERS, teamStatsRows()),
      "",
      "BOX SCORE",
      toCsv(BOX_SCORE_HEADERS, boxScoreRows()),
      "",
      "EVENT LOG",
      toCsv(EVENT_LOG_HEADERS, eventLogRows()),
    ].join("\n");
    downloadCsv(`${selected.name.replace(/[^\w-]+/g, "_")}_full_report.csv`, csv);
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
      <div className="relative">
        <Bloom style={{ width: 380, height: 380, top: -160, left: -80, opacity: 0.3 }} />
        <div className="relative">
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

      {selected && videoIssues.length > 0 && (
        <div className="mt-8">
          <SectionHeading>VIDEO ISSUES</SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videoIssues.map((issue) => (
              <VideoIssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {selected && selected.status !== "Completed" && (
        <div
          className="hs-panel relative mt-8 flex flex-col items-center justify-center gap-3 overflow-hidden p-14 text-center"
          style={{ borderStyle: "dashed" }}
        >
          <Bloom style={{ width: 320, height: 320, top: -140, left: "50%", transform: "translateX(-50%)", opacity: 0.2 }} />
          <span className="relative hs-chip">{PENDING_COPY[selected.status].chip}</span>
          <p className="relative max-w-sm text-sm text-text-faint">{PENDING_COPY[selected.status].message(selected)}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {selected && results && yourTotals && (
          <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameScoreHero
              project={selected}
              yourLabel={selected.scope === "Both Teams" ? "Your Team" : selected.name}
              oppLabel={selected.opponent}
              yourTotals={yourTotals}
              oppTotals={oppTotals}
            />

            <div className="mt-10 flex flex-col gap-6">
              <SectionHeading>PLAYER STATS</SectionHeading>
              <BoxScoreTable
                title={selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM"}
                players={results.team}
                accent
              />
              {results.opponent && (
                <BoxScoreTable title={selected.opponent ?? "OPPONENT"} players={results.opponent} accent={false} />
              )}
            </div>

            <div className="mt-10">
              <SectionHeading>SHOT CHART</SectionHeading>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-mono-tech text-[0.6rem] tracking-[0.14em] text-orange-bright">
                      {selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM"}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                        <span className="h-2 w-2 rounded-full border-2 border-orange-bright bg-orange/20" /> MADE
                      </span>
                      <span className="flex items-center gap-1.5 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                        <span className="h-2 w-2 rounded-full border-2 border-[#ff9b9b]/60 bg-[#ff6b6b]/10" /> MISSED
                      </span>
                    </div>
                  </div>
                  <ShotChart shots={results.teamShots} />
                </div>
                {results.opponentShots && (
                  <div>
                    <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.14em] text-text-muted">
                      {selected.opponent ?? "OPPONENT"}
                    </p>
                    <ShotChart shots={results.opponentShots} />
                  </div>
                )}
              </div>
            </div>

            {(selected.highlightReelPath || selectHighlightClips(results.clips).length > 0) && (
              <div className="mt-10">
                <SectionHeading>HIGHLIGHT REEL</SectionHeading>
                <div className="hs-panel sheen-top p-5">
                  {reelUrl ? (
                    <div className="flex flex-col gap-4">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video src={reelUrl} controls className="w-full rounded border border-border" />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
                          EVERY MADE SHOT &amp; ASSIST WITH A TAGGED CLIP, IN GAME ORDER
                        </p>
                        <button
                          onClick={handleGenerateReel}
                          disabled={reelGenerating}
                          className="hs-btn-secondary disabled:opacity-60"
                        >
                          {reelGenerating
                            ? reelProgress
                              ? `CUTTING ${reelProgress.index + 1}/${reelProgress.total}…`
                              : "GENERATING…"
                            : "REGENERATE"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <p className="max-w-sm text-sm text-text-muted">
                        Stitch every made shot and assist with a tagged clip
                        into one video, in game order.
                      </p>
                      <button
                        onClick={handleGenerateReel}
                        disabled={reelGenerating}
                        className="hs-btn-primary disabled:opacity-60"
                      >
                        {reelGenerating
                          ? reelProgress
                            ? `CUTTING ${reelProgress.index + 1}/${reelProgress.total}…`
                            : "GENERATING…"
                          : "GENERATE HIGHLIGHT REEL"}
                      </button>
                    </div>
                  )}
                  {reelError && (
                    <p className="mt-3 font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]">{reelError}</p>
                  )}
                </div>
              </div>
            )}

            {periodClips.length > 0 && (
              <div className="mt-10">
                <SectionHeading>PERIOD CLIPS</SectionHeading>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {periodClips.map((seg, i) => (
                    <PeriodClipCard key={seg.label} projectId={selected.id} segment={seg} index={i} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10">
              <SectionHeading>TAGGED CLIPS</SectionHeading>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {results.clips.map((c, i) => (
                  <ClipCard key={c.id} projectId={selected.id} clip={c} index={i} />
                ))}
              </div>
            </div>

            <div className="mt-10 mb-2">
              <SectionHeading>REPORTS</SectionHeading>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleDownloadBoxScore} className="hs-btn-secondary">
                  DOWNLOAD BOX SCORE (CSV)
                </button>
                <button onClick={handleDownloadEventLog} className="hs-btn-secondary">
                  DOWNLOAD EVENT LOG (CSV)
                </button>
                <button onClick={handleDownloadFullReport} className="hs-btn-secondary">
                  DOWNLOAD FULL REPORT (CSV)
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {selected && selected.annotationKind === "heart_stats" && heartResults && (
          <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <HeartStatsHero project={selected} heartResults={heartResults} />

            <div className="mt-10 flex flex-col gap-6">
              <SectionHeading>HEART STATS BOX SCORE</SectionHeading>
              <HeartStatsBoxScoreTable
                title={selected.scope === "Both Teams" ? "YOUR TEAM" : "TEAM"}
                players={heartResults.team}
                accent
              />
              {heartResults.opponent && (
                <HeartStatsBoxScoreTable title={selected.opponent ?? "OPPONENT"} players={heartResults.opponent} accent={false} />
              )}
            </div>

            <div className="mt-10">
              <SectionHeading>TAGGED CLIPS</SectionHeading>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {heartResults.clips.map((c, i) => (
                  <ClipCard key={c.id} projectId={selected.id} clip={c} index={i} />
                ))}
              </div>
            </div>

            <div className="mt-10 mb-2">
              <SectionHeading>REPORTS</SectionHeading>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleDownloadHeartStatsBoxScore} className="hs-btn-secondary">
                  DOWNLOAD BOX SCORE (CSV)
                </button>
                <button onClick={handleDownloadEventLog} className="hs-btn-secondary">
                  DOWNLOAD EVENT LOG (CSV)
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
