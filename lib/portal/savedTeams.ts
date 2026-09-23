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
import type { RosterPlayer } from "./store";

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
    list.push({ id: p.id, number: p.number, name: p.name });
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
