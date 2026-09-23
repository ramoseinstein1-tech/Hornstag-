"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import RosterEditor from "@/components/RosterEditor";
import { createSavedTeam, deleteSavedTeam, getPlayerCareerStats, getSavedTeams } from "@/lib/portal/savedTeams";
import type { PlayerCareerStats, SavedTeam } from "@/lib/portal/savedTeams";
import type { RosterPlayer } from "@/lib/portal/store";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-surface-light p-3 text-center">
      <div className="font-display text-base font-semibold text-orange-bright">{value}</div>
      <div className="mt-1 font-mono-tech text-[0.54rem] tracking-[0.1em] text-text-faint">{label}</div>
    </div>
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
                      onClick={() => setExpandedTeamId(expanded ? null : t.id)}
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
                        <ul className="mt-3 flex flex-col gap-1.5 border-l border-border pl-4">
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
