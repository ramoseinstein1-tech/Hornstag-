"use client";

import { motion } from "framer-motion";
import { teamTotals, officialOutcome } from "@/lib/portal/store";
import type { Project, PlayerBoxScore } from "@/lib/portal/store";
import { formatClockMMSS } from "@/lib/portal/segments";

/**
 * Presentational pieces of the client Results page, shared with the public
 * sample-report demo (app/demo/page.tsx) so the two never visually drift —
 * extracted from app/client-portal/results/page.tsx rather than duplicated.
 * Everything here is pure presentation: no data fetching, no Supabase.
 */

export function fgPctOf(m: number, a: number): number {
  return a > 0 ? Math.round((m / a) * 100) : 0;
}

export function formatPlusMinus(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

/** A soft radial color bloom, sized/positioned by the caller — reuses the
 * marketing site's .bloom utility so the portal shares the same ambient
 * atmosphere instead of feeling like a flatter, separate product. */
export function Bloom({ style }: { style?: React.CSSProperties }) {
  return <div className="bloom" style={{ background: "var(--orange)", ...style }} aria-hidden="true" />;
}

export const OUTCOME_STYLES: Record<"team" | "opponent" | "tie", { label: string; className: string }> = {
  team: { label: "WIN", className: "!border-[#7cd48a]/50 !text-[#7cd48a]" },
  opponent: { label: "LOSS", className: "!border-[#ff9b9b]/50 !text-[#ff9b9b]" },
  tie: { label: "TIE", className: "!border-orange/50 !text-orange-bright" },
};

export function MiniStatRow({ label, totals, tone }: { label: string; totals: ReturnType<typeof teamTotals>; tone: "you" | "opp" }) {
  return (
    <div className="flex flex-col gap-3">
      <p
        className={`font-mono-tech text-[0.6rem] tracking-[0.14em] ${tone === "you" ? "text-orange-bright" : "text-text-muted"}`}
      >
        {label}
      </p>
      <div className="grid grid-cols-4 gap-2.5">
        {[
          ["PTS", totals.pts],
          ["REB", totals.reb],
          ["AST", totals.ast],
          ["FG%", `${totals.fgPct}%`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-md border border-border bg-background/40 p-3 text-center backdrop-blur-sm">
            <div className="font-display text-lg font-semibold tabular-nums text-text">{v}</div>
            <div className="mt-0.5 font-mono-tech text-[0.52rem] tracking-[0.1em] text-text-faint">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The centerpiece of the Results page — final score, W/L badge, and a
 * compact stat row per side. */
export function GameScoreHero({
  project,
  yourLabel,
  oppLabel,
  yourTotals,
  oppTotals,
}: {
  project: Project;
  yourLabel: string;
  oppLabel?: string;
  yourTotals: ReturnType<typeof teamTotals>;
  oppTotals: ReturnType<typeof teamTotals> | null;
}) {
  const outcome = project.officialScore ? officialOutcome(project.officialScore) : null;

  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="hs-panel sheen-top relative mt-8 overflow-hidden p-6 sm:p-9"
    >
      <Bloom style={{ width: 460, height: 460, top: -220, left: "50%", transform: "translateX(-50%)" }} />

      <div className="relative z-10 flex flex-col items-center gap-5 text-center">
        {outcome && (
          <span className={`hs-chip ${OUTCOME_STYLES[outcome].className}`}>{OUTCOME_STYLES[outcome].label}</span>
        )}

        {project.officialScore ? (
          <div className="flex items-center gap-5 sm:gap-8">
            <div className="text-right">
              <p className="max-w-[9rem] truncate font-mono-tech text-[0.62rem] tracking-[0.12em] text-text-muted sm:max-w-none">
                {yourLabel.toUpperCase()}
              </p>
              <p className="display-lg tabular-nums text-text">{project.officialScore.team}</p>
            </div>
            <span className="display-md text-text-faint">–</span>
            <div className="text-left">
              <p className="max-w-[9rem] truncate font-mono-tech text-[0.62rem] tracking-[0.12em] text-text-muted sm:max-w-none">
                {(oppLabel ?? "OPPONENT").toUpperCase()}
              </p>
              <p className="display-lg tabular-nums text-text">{project.officialScore.opponent}</p>
            </div>
          </div>
        ) : (
          <h2 className="display-md text-text">{project.name}</h2>
        )}

        {project.scoreCheckNote && (
          <div className="max-w-md rounded-md border p-3" style={{ borderColor: "var(--border-orange)" }}>
            <p className="mb-1 font-mono-tech text-[0.56rem] tracking-[0.14em] text-orange-bright">SCORE CHECK NOTE</p>
            <p className="text-xs leading-relaxed text-text-muted">{project.scoreCheckNote}</p>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-8 grid grid-cols-1 gap-6 border-t border-border pt-7 sm:grid-cols-2">
        <MiniStatRow label={project.scope === "Both Teams" ? "YOUR TEAM" : "TEAM"} totals={yourTotals} tone="you" />
        {oppTotals && <MiniStatRow label={oppLabel ?? "OPPONENT"} totals={oppTotals} tone="opp" />}
      </div>
    </motion.div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
      <span className="h-px w-4 bg-orange/50" aria-hidden="true" />
      {children}
    </h2>
  );
}

export function BoxScoreTable({ title, players, accent }: { title: string; players: PlayerBoxScore[]; accent: boolean }) {
  const totals = teamTotals(players);
  const totalMinSeconds = players.reduce((sum, p) => sum + p.minSeconds, 0);

  return (
    <div className="hs-panel sheen-top overflow-hidden p-5" style={accent ? { borderColor: "var(--border-orange)" } : undefined}>
      <h3 className={`mb-4 font-mono-tech text-[0.64rem] tracking-[0.18em] ${accent ? "text-orange-bright" : "text-text-soft"}`}>
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {["PLAYER", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FG", "FG%", "3P", "3P%", "+/-"].map((h) => (
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
              <tr key={`${p.number}-${p.name}`} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-light/60">
                <td className="py-2.5 pr-4 text-text">
                  #{p.number} {p.name}
                </td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{formatClockMMSS(p.minSeconds)}</td>
                <td className="py-2.5 pr-4 font-mono-tech text-base font-semibold tabular-nums text-orange-bright">{p.pts}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.reb}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.ast}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.stl}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.blk}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{p.tov}</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">
                  {p.fgm}/{p.fga}
                </td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{fgPctOf(p.fgm, p.fga)}%</td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">
                  {p.tpm}/{p.tpa}
                </td>
                <td className="py-2.5 pr-4 font-mono-tech tabular-nums text-text-muted">{fgPctOf(p.tpm, p.tpa)}%</td>
                <td className={`py-2.5 pr-4 font-mono-tech tabular-nums ${p.plusMinus > 0 ? "text-[#7cd48a]" : p.plusMinus < 0 ? "text-[#ff9b9b]" : "text-text-muted"}`}>
                  {formatPlusMinus(p.plusMinus)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border text-left">
              <td className="pt-2.5 pr-4 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">TOTAL</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">{formatClockMMSS(totalMinSeconds)}</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-orange-bright">{totals.pts}</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">{totals.reb}</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">{totals.ast}</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">{totals.stl}</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">{totals.blk}</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">{totals.tov}</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">
                {totals.fgm}/{totals.fga}
              </td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">{totals.fgPct}%</td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">
                {totals.tpm}/{totals.tpa}
              </td>
              <td className="pt-2.5 pr-4 font-mono-tech tabular-nums text-text-faint">{totals.tpPct}%</td>
              <td className="pt-2.5 pr-4 font-mono-tech text-text-faint">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
