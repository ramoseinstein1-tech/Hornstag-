"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import RosterEditor from "@/components/RosterEditor";
import {
  createSavedTeam,
  deleteSavedTeam,
  getPlayerCareerStats,
  getSavedTeams,
  getTeamSeasonTrend,
} from "@/lib/portal/savedTeams";
import type { PlayerCareerStats, SavedTeam, TeamSeasonTrend } from "@/lib/portal/savedTeams";
import type { RosterPlayer } from "@/lib/portal/store";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-surface-light p-3 text-center">
      <div className="font-display text-base font-semibold text-orange-bright">{value}</div>
      <div className="mt-1 font-mono-tech text-[0.54rem] tracking-[0.1em] text-text-faint">{label}</div>
    </div>
  );
}

/** Game-by-game margin bar chart — green above the zero line for a win,
 * red below it for a loss, bar height scaled to the largest margin in
 * the set so a blowout and a nail-biter are visually distinct. */
function SeasonTrendChart({ games }: { games: TeamSeasonTrend["games"] }) {
  const w = 22;
  const gap = 6;
  const h = 72;
  const maxMargin = Math.max(1, ...games.map((g) => Math.abs(g.teamScore - g.oppScore)));
  const width = games.length * (w + gap);

  return (
    <svg viewBox={`0 0 ${width} ${h}`} width={width} height={h} role="img" aria-label="Score margin per game">
      <line x1={0} y1={h / 2} x2={width} y2={h / 2} stroke="var(--border)" strokeWidth={1} />
      {games.map((g, i) => {
        const margin = g.teamScore - g.oppScore;
        const barH = Math.max(2, (Math.abs(margin) / maxMargin) * (h / 2 - 4));
        const color = g.outcome === "team" ? "#7cd48a" : g.outcome === "opponent" ? "#ff9b9b" : "var(--orange-bright)";
        const x = i * (w + gap);
        const y = margin >= 0 ? h / 2 - barH : h / 2;
        return (
          <g key={g.projectId}>
            <rect x={x} y={y} width={w} height={barH} rx={2} fill={color} fillOpacity={0.75} />
            <title>{`${g.opponent ?? g.name}: ${g.teamScore}-${g.oppScore}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/** Points-per-game sparkline for a single player's career, oldest game
 * first — the last point is drawn larger and in the brand orange so the
 * most recent game reads as the "current form" marker. */
function PlayerTrendSparkline({ gameLog }: { gameLog: { date: string; pts: number }[] }) {
  const w = 160;
  const h = 40;
  const pad = 4;
  const max = Math.max(1, ...gameLog.map((g) => g.pts));
  const step = gameLog.length > 1 ? (w - pad * 2) / (gameLog.length - 1) : 0;
  const points = gameLog.map((g, i) => ({
    x: pad + i * step,
    y: h - pad - (g.pts / max) * (h - pad * 2),
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Points per game trend">
      <path d={path} fill="none" stroke="var(--orange)" strokeWidth={1.5} strokeOpacity={0.6} />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 3 : 2}
          fill={i === points.length - 1 ? "var(--orange-bright)" : "var(--text-faint)"}
        />
      ))}
    </svg>
  );
}

/**
 * Manage saved rosters and view a saved player's career stats — its own
 * top-level client-portal page (promoted out of Account Settings, which
 * is where it originally lived) since it's a feature clients return to
 * on every upload, not a one-off account preference.
 */
export default function SavedTeamsManager() {
  const { user } = useAuth();

  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [addingTeam, setAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamRoster, setNewTeamRoster] = useState<RosterPlayer[]>([
    { id: crypto.randomUUID(), number: "", name: "" },
  ]);
  const [teamSaving, setTeamSaving] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [seasonTrends, setSeasonTrends] = useState<Record<string, TeamSeasonTrend>>({});
  const [seasonLoading, setSeasonLoading] = useState<string | null>(null);

  const [profilePlayer, setProfilePlayer] = useState<RosterPlayer | null>(null);
  const [profileStats, setProfileStats] = useState<PlayerCareerStats | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getSavedTeams(user.id).then(setSavedTeams);
  }, [user]);

  function flashNotice(text: string, tone: "info" | "error" = "info") {
    setNotice({ text, tone });
    setTimeout(() => setNotice(null), 4000);
  }

  async function handleToggleTeam(teamId: string) {
    const next = expandedTeamId === teamId ? null : teamId;
    setExpandedTeamId(next);
    if (next && !seasonTrends[next]) {
      setSeasonLoading(next);
      const trend = await getTeamSeasonTrend(next);
      setSeasonLoading(null);
      setSeasonTrends((prev) => ({ ...prev, [next]: trend }));
    }
  }

  async function openPlayerProfile(player: RosterPlayer) {
    setProfilePlayer(player);
    setProfileStats(null);
    if (!player.savedPlayerId) return;
    setProfileLoading(true);
    const stats = await getPlayerCareerStats(player.savedPlayerId);
    setProfileLoading(false);
    setProfileStats(stats);
  }

  async function handleSaveTeam() {
    if (!user || !newTeamName.trim()) return;
    const validRoster = newTeamRoster.filter((p) => p.number.trim() && p.name.trim());
    if (validRoster.length === 0) return;

    setTeamSaving(true);
    const result = await createSavedTeam(user.id, newTeamName.trim(), validRoster);
    setTeamSaving(false);
    if (!result.ok) {
      flashNotice(result.error, "error");
      return;
    }
    setNewTeamName("");
    setNewTeamRoster([{ id: crypto.randomUUID(), number: "", name: "" }]);
    setAddingTeam(false);
    getSavedTeams(user.id).then(setSavedTeams);
    flashNotice("Team saved.");
  }

  async function handleDeleteTeam(teamId: string) {
    await deleteSavedTeam(teamId);
    setSavedTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  if (!user) return null;

  return (
    <div>
      <p className="eyebrow mb-3">CLIENT PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Saved </span>
        <span className="text-gradient-orange">Teams.</span>
      </h1>
      <p className="mt-2 max-w-lg text-sm text-text-muted">
        Save your own roster once and reuse it on every future upload — and
        track each player&rsquo;s stats across every game they&rsquo;ve been in.
      </p>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div
              className="mt-6 rounded-md border px-4 py-3 font-mono-tech text-[0.68rem] leading-relaxed"
              style={
                notice.tone === "error"
                  ? { borderColor: "rgba(255,107,107,0.3)", background: "rgba(255,107,107,0.06)", color: "#ff9b9b" }
                  : { borderColor: "var(--border-orange)", background: "rgba(255,106,0,0.06)", color: "var(--orange-bright)" }
              }
            >
              {notice.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 hs-panel sheen-top max-w-2xl p-6">
        {savedTeams.length === 0 && !addingTeam && (
          <p className="mb-4 text-sm text-text-faint">No saved teams yet.</p>
        )}

        {savedTeams.length > 0 && (
          <ul className="mb-5 flex flex-col divide-y divide-border">
            {savedTeams.map((t) => {
              const expanded = expandedTeamId === t.id;
              return (
                <li key={t.id} className="py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleToggleTeam(t.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm text-text">
                        {t.name} <span className="text-text-faint">{expanded ? "▾" : "▸"}</span>
                      </p>
                      <p className="truncate font-mono-tech text-[0.6rem] tracking-[0.06em] text-text-faint">
                        {t.roster.length} PLAYER{t.roster.length === 1 ? "" : "S"}
                      </p>
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(t.id)}
                      aria-label={`Delete ${t.name}`}
                      className="flex-none text-text-faint transition-colors hover:text-[#ff6b6b]"
                    >
                      ✕
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 border-l border-border pl-4">
                          <p className="mb-2 font-mono-tech text-[0.58rem] tracking-[0.14em] text-text-faint">
                            SEASON TREND
                          </p>
                          {seasonLoading === t.id && (
                            <p className="text-xs text-text-faint">Loading…</p>
                          )}
                          {seasonLoading !== t.id && seasonTrends[t.id] && seasonTrends[t.id].games.length === 0 && (
                            <p className="text-xs text-text-faint">
                              No completed traditional games with a recorded final score yet.
                            </p>
                          )}
                          {seasonLoading !== t.id && seasonTrends[t.id] && seasonTrends[t.id].games.length > 0 && (
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-muted">
                                <span>
                                  <span className="text-[#7cd48a]">{seasonTrends[t.id].wins}W</span>
                                  {" – "}
                                  <span className="text-[#ff9b9b]">{seasonTrends[t.id].losses}L</span>
                                  {seasonTrends[t.id].ties > 0 && <> – {seasonTrends[t.id].ties}T</>}
                                </span>
                                <span>{seasonTrends[t.id].avgPointsFor} PTS FOR</span>
                                <span>{seasonTrends[t.id].avgPointsAgainst} PTS AGAINST</span>
                              </div>
                              <div className="overflow-x-auto">
                                <SeasonTrendChart games={seasonTrends[t.id].games} />
                              </div>
                            </div>
                          )}
                        </div>
                        <ul className="mt-4 flex flex-col gap-1.5 border-l border-border pl-4">
                          {t.roster.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-text-muted">
                                #{p.number} {p.name}
                              </span>
                              <button
                                onClick={() => openPlayerProfile(p)}
                                className="flex-none font-mono-tech text-[0.58rem] tracking-[0.1em] text-orange-bright transition-colors hover:text-orange"
                              >
                                VIEW PROFILE
                              </button>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}

        {addingTeam ? (
          <div className="flex flex-col gap-4 border-t border-border pt-5">
            <div>
              <label htmlFor="new-team-name" className="hs-label">TEAM NAME</label>
              <input
                id="new-team-name"
                className="hs-input"
                placeholder="Hornstag Varsity"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
            </div>
            <RosterEditor label="ROSTER" players={newTeamRoster} onChange={setNewTeamRoster} />
            <div className="flex items-center gap-4">
              <button
                onClick={handleSaveTeam}
                disabled={teamSaving}
                className="hs-btn-secondary w-fit disabled:opacity-60"
              >
                {teamSaving ? "SAVING..." : "SAVE TEAM"}
              </button>
              <button
                onClick={() => {
                  setAddingTeam(false);
                  setNewTeamName("");
                  setNewTeamRoster([{ id: crypto.randomUUID(), number: "", name: "" }]);
                }}
                className="hs-btn-ghost"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingTeam(true)}
            className="font-mono-tech text-[0.66rem] tracking-[0.14em] text-orange-bright transition-colors hover:text-orange"
          >
            + ADD A TEAM
          </button>
        )}
      </div>

      <AnimatePresence>
        {profilePlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="hs-panel sheen-top w-full max-w-md p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-mono-tech text-[0.6rem] tracking-[0.2em] text-text-faint">CAREER STATS</h2>
                  <p className="mt-1 font-display text-lg font-semibold text-text">
                    #{profilePlayer.number} {profilePlayer.name}
                  </p>
                </div>
                <button
                  onClick={() => setProfilePlayer(null)}
                  aria-label="Close"
                  className="text-text-faint transition-colors hover:text-orange-bright"
                >
                  ✕
                </button>
              </div>

              {profileLoading && (
                <p className="mt-6 text-center text-sm text-text-faint">Loading…</p>
              )}

              {!profileLoading && profileStats && (
                <div className="mt-6 flex flex-col gap-6">
                  <div>
                    <p className="mb-3 font-mono-tech text-[0.58rem] tracking-[0.14em] text-text-faint">
                      TRADITIONAL — {profileStats.gamesPlayed} GAME{profileStats.gamesPlayed === 1 ? "" : "S"}
                    </p>
                    {profileStats.gamesPlayed === 0 ? (
                      <p className="text-xs text-text-faint">No completed traditional games yet.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        <StatBox label="PTS" value={(profileStats.pts / profileStats.gamesPlayed).toFixed(1)} />
                        <StatBox label="REB" value={(profileStats.reb / profileStats.gamesPlayed).toFixed(1)} />
                        <StatBox label="AST" value={(profileStats.ast / profileStats.gamesPlayed).toFixed(1)} />
                        <StatBox label="STL" value={(profileStats.stl / profileStats.gamesPlayed).toFixed(1)} />
                        <StatBox label="BLK" value={(profileStats.blk / profileStats.gamesPlayed).toFixed(1)} />
                        <StatBox label="TOV" value={(profileStats.tov / profileStats.gamesPlayed).toFixed(1)} />
                        <StatBox
                          label="FG%"
                          value={profileStats.fga > 0 ? `${Math.round((profileStats.fgm / profileStats.fga) * 100)}%` : "—"}
                        />
                        <StatBox
                          label="3P%"
                          value={profileStats.tpa > 0 ? `${Math.round((profileStats.tpm / profileStats.tpa) * 100)}%` : "—"}
                        />
                      </div>
                    )}
                    <p className="mt-2 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                      TOTALS: {profileStats.pts} PTS · {profileStats.reb} REB · {profileStats.ast} AST
                    </p>
                    {profileStats.gameLog.length > 1 && (
                      <div className="mt-4">
                        <p className="mb-1.5 font-mono-tech text-[0.54rem] tracking-[0.1em] text-text-faint">
                          POINTS PER GAME
                        </p>
                        <PlayerTrendSparkline gameLog={profileStats.gameLog} />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-5">
                    <p className="mb-3 font-mono-tech text-[0.58rem] tracking-[0.14em] text-text-faint">
                      HEART STATS — {profileStats.heartStatsGamesPlayed} GAME{profileStats.heartStatsGamesPlayed === 1 ? "" : "S"}
                    </p>
                    {profileStats.heartStatsGamesPlayed === 0 ? (
                      <p className="text-xs text-text-faint">No completed Heart Stats games yet.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <StatBox label="DEFL" value={profileStats.deflections} />
                        <StatBox label="LOOSE BALLS" value={profileStats.looseBallsRecovered} />
                        <StatBox label="CHARGES" value={profileStats.chargesDrawn} />
                        <StatBox label="SCREEN AST" value={profileStats.screenAssists} />
                        <StatBox label="CONTESTED" value={profileStats.contestedShots} />
                        <StatBox label="BOX OUTS" value={`${profileStats.boxOutsWon}/${profileStats.boxOutsAttempted}`} />
                        <StatBox label="SCREENS" value={`${profileStats.screensGood}/${profileStats.screensAttempted}`} />
                        <StatBox label="BLOWN BY" value={profileStats.blowBysAllowed} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!profileLoading && !profileStats && (
                <p className="mt-6 text-sm text-text-faint">
                  This player was added by hand, not loaded from a saved team, so there&rsquo;s no career history to show.
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
