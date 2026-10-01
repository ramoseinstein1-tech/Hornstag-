import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShotChart from "@/components/client-portal/ShotChart";
import { SectionHeading, BoxScoreTable, GameScoreHero } from "@/components/client-portal/ResultsDisplay";
import { teamTotals } from "@/lib/portal/store";
import type { Project, PlayerBoxScore } from "@/lib/portal/store";
import type { ShotChartPoint } from "@/lib/portal/store";

export const metadata: Metadata = {
  title: "Sample Report — Hornstag",
  description:
    "A real example of what you get back from Hornstag: a full box score, shot chart, and tagged clips from one game.",
};

// Fabricated for this public demo — never fetched from Supabase, and
// clearly labeled as a sample throughout the page. Numbers are made up
// but internally consistent (box score totals roughly match the final
// score), so the page reads like an actual delivered report.
const DEMO_PROJECT: Project = {
  id: "demo",
  ownerId: "demo",
  ownerName: "Coach Ramos",
  name: "Hornstag Warriors vs. Riverside Hawks",
  opponent: "Riverside Hawks",
  gameDate: "2026-09-12",
  scope: "Both Teams",
  annotationKind: "traditional",
  format: "Quarters",
  roster: [],
  videoCleared: false,
  status: "Completed",
  progress: 100,
  officialScore: { team: 68, opponent: 61 },
  annotationStatus: "Completed",
  createdAt: "2026-09-13T00:00:00Z",
  updatedAt: "2026-09-13T00:00:00Z",
};

const TEAM_PLAYERS: PlayerBoxScore[] = [
  { number: "23", name: "D. Cruz", pts: 21, reb: 6, ast: 3, stl: 2, blk: 0, tov: 2, fga: 16, fgm: 9, tpa: 4, tpm: 2, minSeconds: 1694, plusMinus: 11 },
  { number: "11", name: "J. Santos", pts: 14, reb: 4, ast: 7, stl: 3, blk: 0, tov: 3, fga: 13, fgm: 6, tpa: 3, tpm: 1, minSeconds: 1540, plusMinus: 8 },
  { number: "5", name: "M. Reyes", pts: 11, reb: 8, ast: 1, stl: 1, blk: 2, tov: 1, fga: 10, fgm: 4, tpa: 0, tpm: 0, minSeconds: 1322, plusMinus: 6 },
  { number: "7", name: "A. Torres", pts: 10, reb: 3, ast: 2, stl: 1, blk: 0, tov: 2, fga: 9, fgm: 4, tpa: 2, tpm: 1, minSeconds: 1108, plusMinus: 4 },
  { number: "14", name: "R. Villanueva", pts: 8, reb: 5, ast: 2, stl: 0, blk: 1, tov: 1, fga: 7, fgm: 3, tpa: 1, tpm: 0, minSeconds: 986, plusMinus: 3 },
  { number: "9", name: "K. Dela Peña", pts: 4, reb: 2, ast: 1, stl: 1, blk: 0, tov: 1, fga: 5, fgm: 2, tpa: 0, tpm: 0, minSeconds: 614, plusMinus: -2 },
];

const OPPONENT_PLAYERS: PlayerBoxScore[] = [
  { number: "3", name: "L. Bautista", pts: 19, reb: 5, ast: 2, stl: 1, blk: 0, tov: 3, fga: 17, fgm: 8, tpa: 5, tpm: 2, minSeconds: 1680, plusMinus: -9 },
  { number: "21", name: "P. Mendoza", pts: 13, reb: 7, ast: 1, stl: 0, blk: 1, tov: 2, fga: 12, fgm: 5, tpa: 1, tpm: 0, minSeconds: 1502, plusMinus: -6 },
  { number: "8", name: "C. Garcia", pts: 10, reb: 4, ast: 4, stl: 2, blk: 0, tov: 2, fga: 9, fgm: 4, tpa: 0, tpm: 0, minSeconds: 1290, plusMinus: -5 },
  { number: "15", name: "N. Aquino", pts: 9, reb: 6, ast: 1, stl: 1, blk: 1, tov: 1, fga: 8, fgm: 3, tpa: 1, tpm: 1, minSeconds: 1160, plusMinus: -3 },
  { number: "4", name: "J. Fernandez", pts: 6, reb: 2, ast: 3, stl: 0, blk: 0, tov: 2, fga: 6, fgm: 2, tpa: 0, tpm: 0, minSeconds: 940, plusMinus: -4 },
  { number: "12", name: "E. Ramirez", pts: 4, reb: 3, ast: 0, stl: 1, blk: 0, tov: 0, fga: 4, fgm: 2, tpa: 0, tpm: 0, minSeconds: 528, plusMinus: -2 },
];

const TEAM_SHOTS: ShotChartPoint[] = [
  { x: 0.1, y: 0.5, made: true }, { x: 0.14, y: 0.38, made: true }, { x: 0.18, y: 0.62, made: false },
  { x: 0.22, y: 0.3, made: true }, { x: 0.2, y: 0.5, made: true }, { x: 0.28, y: 0.44, made: false },
  { x: 0.32, y: 0.58, made: true }, { x: 0.16, y: 0.2, made: false }, { x: 0.16, y: 0.8, made: true },
  { x: 0.06, y: 0.5, made: true }, { x: 0.24, y: 0.68, made: false }, { x: 0.3, y: 0.3, made: true },
  { x: 0.19, y: 0.45, made: true }, { x: 0.26, y: 0.2, made: false }, { x: 0.12, y: 0.56, made: true },
  { x: 0.34, y: 0.5, made: false }, { x: 0.21, y: 0.33, made: true }, { x: 0.09, y: 0.42, made: true },
];

const OPPONENT_SHOTS: ShotChartPoint[] = [
  { x: 0.9, y: 0.5, made: true }, { x: 0.86, y: 0.38, made: false }, { x: 0.82, y: 0.62, made: true },
  { x: 0.78, y: 0.3, made: true }, { x: 0.8, y: 0.5, made: false }, { x: 0.72, y: 0.44, made: true },
  { x: 0.68, y: 0.58, made: false }, { x: 0.84, y: 0.2, made: true }, { x: 0.84, y: 0.8, made: false },
  { x: 0.94, y: 0.5, made: true }, { x: 0.76, y: 0.68, made: true }, { x: 0.7, y: 0.3, made: false },
  { x: 0.81, y: 0.45, made: true }, { x: 0.74, y: 0.2, made: false }, { x: 0.88, y: 0.56, made: true },
];

const SAMPLE_CLIPS = [
  { label: "3PT MADE", time: "Q1 · 8:42", player: "#23 D. Cruz" },
  { label: "ASSIST", time: "Q1 · 6:15", player: "#11 J. Santos" },
  { label: "STEAL", time: "Q2 · 9:03", player: "#11 J. Santos" },
  { label: "BLOCK", time: "Q2 · 4:28", player: "#5 M. Reyes" },
  { label: "2PT MADE", time: "Q3 · 7:50", player: "#7 A. Torres" },
  { label: "OFF. REBOUND", time: "Q3 · 2:11", player: "#5 M. Reyes" },
  { label: "3PT MADE", time: "Q4 · 5:37", player: "#23 D. Cruz" },
  { label: "ASSIST", time: "Q4 · 1:04", player: "#14 R. Villanueva" },
];

export default function DemoReportPage() {
  const yourTotals = teamTotals(TEAM_PLAYERS);
  const oppTotals = teamTotals(OPPONENT_PLAYERS);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-md border border-orange/30 bg-orange/[0.06] px-5 py-4">
          <div>
            <p className="font-mono-tech text-[0.62rem] tracking-[0.18em] text-orange-bright">SAMPLE REPORT</p>
            <p className="mt-1 text-sm text-text-muted">
              Fabricated game for demonstration — this is exactly what your
              own Results page looks like after a real game is annotated.
            </p>
          </div>
          <Link href="/signup" className="hs-btn-primary flex-none">
            CLAIM YOUR FREE GAME
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <p className="eyebrow mb-3">CLIENT PORTAL — RESULTS</p>
        <h1 className="display-md uppercase">
          <span className="text-gradient">Sample </span>
          <span className="text-gradient-orange">Game Report.</span>
        </h1>
        <p className="mt-2 max-w-lg text-sm text-text-muted">
          Every number and clip below came from one uploaded game film — no
          manual stat-keeping involved.
        </p>

        <GameScoreHero
          project={DEMO_PROJECT}
          yourLabel="Hornstag Warriors"
          oppLabel="Riverside Hawks"
          yourTotals={yourTotals}
          oppTotals={oppTotals}
        />

        <div className="mt-10 flex flex-col gap-6">
          <SectionHeading>PLAYER STATS</SectionHeading>
          <BoxScoreTable title="HORNSTAG WARRIORS" players={TEAM_PLAYERS} accent />
          <BoxScoreTable title="RIVERSIDE HAWKS" players={OPPONENT_PLAYERS} accent={false} />
        </div>

        <div className="mt-10">
          <SectionHeading>SHOT CHART</SectionHeading>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.14em] text-orange-bright">HORNSTAG WARRIORS</p>
              <ShotChart shots={TEAM_SHOTS} />
            </div>
            <div>
              <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.14em] text-text-muted">RIVERSIDE HAWKS</p>
              <ShotChart shots={OPPONENT_SHOTS} />
            </div>
          </div>
        </div>

        <div className="mt-10">
          <SectionHeading>TAGGED CLIPS</SectionHeading>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SAMPLE_CLIPS.map((c, i) => (
              <div key={i} className="hs-panel sheen-top flex flex-col overflow-hidden text-left">
                <div
                  className="relative flex h-28 flex-none items-center justify-center"
                  style={{ background: "linear-gradient(160deg, rgba(255,106,0,0.18), rgba(255,106,0,0.02))" }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-orange/40 bg-background/60 text-orange-bright">▶</span>
                  <span className="absolute bottom-2 right-2 font-mono-tech text-[0.58rem] tracking-[0.1em] text-text-faint">{c.time}</span>
                </div>
                <div className="p-3.5">
                  <p className="font-display text-sm font-semibold uppercase tracking-tight text-orange-bright">{c.label}</p>
                  <p className="mt-1 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-muted">{c.player}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-faint">
            In your real portal, every card here plays the exact video moment.
          </p>
        </div>

        <div className="hs-panel sheen-top mt-14 flex flex-col items-center gap-4 p-10 text-center">
          <p className="eyebrow">YOUR FIRST GAME IS FREE</p>
          <h2 className="display-md max-w-md uppercase">
            Upload one game.<br /><span className="text-gradient-orange">See your own report.</span>
          </h2>
          <Link href="/signup" className="hs-btn-primary mt-2">
            GET STARTED — FREE
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
