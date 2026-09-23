/**
 * SAVED TEAMS
 * ─────────────────────────────────────────────────────────────────
 * Lets a client save their own team's roster once (from Settings, or
 * directly off the upload form) and reuse it on future uploads instead
 * of retyping it every time. Own team only — opponents vary game to
 * game, so there's no reuse benefit there.
 *
 * Fetches saved_team_players as a SEPARATE query rather than a nested
 * `saved_teams.select("*, saved_team_players(*)")` embed — that exact
 * embed pattern, combined with RLS on both tables, silently duplicated
 * parent rows elsewhere in this app (see lib/portal/store.ts's
 * attachRosters and its comment) once per child row. Not worth risking
 * again here.
 */

import { createClient } from "@/lib/supabase/client";
import type { AnnotationKind, RosterPlayer } from "./store";
import { getEvents } from "./events";
import { computeBoxScoreForSide, computeHeartStatsBoxScore } from "./results";

export type SavedTeam = {
  id: string;
  name: string;
  roster: RosterPlayer[];
};

type SavedTeamRow = { id: string; name: string; created_at: string };
type SavedTeamPlayerRow = { id: string; saved_team_id: string; number: string; name: string; sort_order: number };

export async function getSavedTeams(userId: string): Promise<SavedTeam[]> {
  const supabase = createClient();
  const { data: teams, error } = await supabase
    .from("saved_teams")
    .select("id, name, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error || !teams || teams.length === 0) return [];

  const { data: players } = await supabase
    .from("saved_team_players")
    .select("*")
    .in("saved_team_id", (teams as SavedTeamRow[]).map((t) => t.id));

  const byTeam = new Map<string, RosterPlayer[]>();
  for (const p of (players as SavedTeamPlayerRow[] | null) ?? []) {
    const list = byTeam.get(p.saved_team_id) ?? [];
    // savedPlayerId mirrors id here — this row's own id IS the stable
    // saved-player identity that roster_players.saved_player_id points
    // back at, so career-stat lookups can use it directly.
    list.push({ id: p.id, number: p.number, name: p.name, savedPlayerId: p.id });
    byTeam.set(p.saved_team_id, list);
  }

  return (teams as SavedTeamRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    roster: byTeam.get(t.id) ?? [],
  }));
}

export async function createSavedTeam(
  ownerId: string,
  name: string,
  roster: RosterPlayer[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: team, error } = await supabase
    .from("saved_teams")
    .insert({ owner_id: ownerId, name })
    .select()
    .single();
  if (error || !team) return { ok: false, error: error?.message ?? "Couldn't save this team." };

  if (roster.length > 0) {
    const { error: playersError } = await supabase.from("saved_team_players").insert(
      roster.map((p, i) => ({ saved_team_id: team.id, number: p.number, name: p.name, sort_order: i }))
    );
    if (playersError) return { ok: false, error: playersError.message };
  }
  return { ok: true };
}

export async function deleteSavedTeam(teamId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("saved_teams").delete().eq("id", teamId);
}

/** A saved player's stats summed across every COMPLETED project they've
 * been loaded into (see roster_players.saved_player_id, set by the
 * upload page's loadSavedTeam) — traditional and Heart Stats totals are
 * kept separate, same as everywhere else these two packages meet. */
export type PlayerCareerStats = {
  gamesPlayed: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  heartStatsGamesPlayed: number;
  deflections: number;
  looseBallsRecovered: number;
  chargesDrawn: number;
  screenAssists: number;
  contestedShots: number;
  boxOutsWon: number;
  boxOutsAttempted: number;
};

function emptyCareerStats(): PlayerCareerStats {
  return {
    gamesPlayed: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0,
    heartStatsGamesPlayed: 0, deflections: 0, looseBallsRecovered: 0, chargesDrawn: 0,
    screenAssists: 0, contestedShots: 0, boxOutsWon: 0, boxOutsAttempted: 0,
  };
}

type CareerRosterRow = { id: string; project_id: string; number: string; name: string };
type CareerProjectRow = { id: string; annotation_kind: AnnotationKind };

export async function getPlayerCareerStats(savedPlayerId: string): Promise<PlayerCareerStats> {
  const supabase = createClient();
  const stats = emptyCareerStats();

  const { data: rosterRows } = await supabase
    .from("roster_players")
    .select("id, project_id, number, name")
    .eq("saved_player_id", savedPlayerId);
  if (!rosterRows || rosterRows.length === 0) return stats;

  // Only completed projects have real, final annotation data worth
  // summing — an in-progress project's partial tags would understate a
  // player's career totals rather than just being absent from them.
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, annotation_kind")
    .in("id", (rosterRows as CareerRosterRow[]).map((r) => r.project_id))
    .eq("status", "Completed");
  if (!projectRows || projectRows.length === 0) return stats;

  const kindByProject = new Map((projectRows as CareerProjectRow[]).map((p) => [p.id, p.annotation_kind]));

  for (const row of rosterRows as CareerRosterRow[]) {
    const kind = kindByProject.get(row.project_id);
    if (!kind) continue; // project not completed (or not visible to this caller)

    const events = await getEvents(row.project_id);
    const rosterPlayer: RosterPlayer = { id: row.id, number: row.number, name: row.name };

    if (kind === "heart_stats") {
      const [box] = computeHeartStatsBoxScore([rosterPlayer], events, "team");
      stats.heartStatsGamesPlayed += 1;
      stats.deflections += box.deflections;
      stats.looseBallsRecovered += box.looseBallsRecovered;
      stats.chargesDrawn += box.chargesDrawn;
      stats.screenAssists += box.screenAssists;
      stats.contestedShots += box.contestedShots;
      stats.boxOutsWon += box.boxOutsWon;
      stats.boxOutsAttempted += box.boxOutsAttempted;
    } else {
      const [box] = computeBoxScoreForSide([rosterPlayer], events, [], "team");
      stats.gamesPlayed += 1;
      stats.pts += box.pts;
      stats.reb += box.reb;
      stats.ast += box.ast;
      stats.stl += box.stl;
      stats.blk += box.blk;
      stats.tov += box.tov;
      stats.fgm += box.fgm;
      stats.fga += box.fga;
      stats.tpm += box.tpm;
      stats.tpa += box.tpa;
    }
  }

  return stats;
}
