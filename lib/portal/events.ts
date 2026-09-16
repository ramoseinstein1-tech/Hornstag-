/**
 * REAL, SUPABASE-BACKED ANNOTATION EVENT STORE
 * ─────────────────────────────────────────────────────────────────
 * Replaces the old per-project localStorage store. Events now live in
 * the `annotation_events` table (see supabase/migrations/00000000000000_
 * init.sql), shared across users via RLS instead of the old
 * origin-wide-localStorage trick — the client who owns the project and
 * the annotator who tagged it now genuinely share the same rows.
 *
 * Exact-duplicate rejection used to be an app-level pre-check here; it's
 * now a real Postgres unique index (annotation_events_dedupe_idx), so a
 * double-click race between two inserts can't slip both through. We just
 * catch Postgres's unique-violation error code (23505) and translate it
 * to the same user-facing message as before.
 */

import { createClient } from "@/lib/supabase/client";

export type EventType =
  | "two_point"
  | "three_point"
  | "free_throw"
  | "assist"
  | "steal"
  | "block"
  | "turnover"
  | "foul"
  | "offensive_foul"
  | "defensive_foul"
  | "technical_foul"
  | "offensive_rebound"
  | "defensive_rebound"
  | "substitution_in"
  | "substitution_out"
  | "timeout"
  | "custom";

export const SHOT_EVENT_TYPES: readonly EventType[] = ["two_point", "three_point", "free_throw"];

/** The only event type with neither a team nor a player — a bare
 * timestamp is all it needs (confirmed with the user: "don't think we
 * need to record whose timeout it is"). */
export const TEAMLESS_EVENT_TYPES: readonly EventType[] = ["timeout"];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  two_point: "Two Point",
  three_point: "Three Point",
  free_throw: "Free Throw",
  assist: "Assist",
  steal: "Steal",
  block: "Block",
  turnover: "Turnover",
  foul: "Foul",
  offensive_foul: "Offensive Foul",
  defensive_foul: "Defensive Foul",
  technical_foul: "Technical Foul",
  offensive_rebound: "Offensive Rebound",
  defensive_rebound: "Defensive Rebound",
  substitution_in: "Substitution In",
  substitution_out: "Substitution Out",
  timeout: "Timeout",
  custom: "Custom",
};

/** matches Project.roster vs Project.opponentRoster — simpler than
 * inventing a fake teamId, since no separate Team entity exists. */
export type TeamSide = "team" | "opponent";

/** Normalized 0..1, relative to the court diagram's own width/height, so
 * it stays accurate across any render size. */
export type ShotLocation = { x: number; y: number };

export type AnnotationEvent = {
  id: string;
  projectId: string;
  timestampSeconds: number;
  /** Absent only for TEAMLESS_EVENT_TYPES (currently just Timeout). */
  teamSide?: TeamSide;
  /** Absent only for TEAMLESS_EVENT_TYPES (currently just Timeout). */
  playerId?: string;
  eventType: EventType;
  /** Only meaningful when eventType is a shot type. */
  made?: boolean;
  /** Only present when eventType is a shot type. */
  shotLocation?: ShotLocation;
  /** Only used when eventType === "custom". */
  customLabel?: string;
  /** Which segment (e.g. "Q2", "H1") this timestamp falls in — derived
   * from lib/portal/segments.ts's periodForTimestamp() at save time, not
   * from whichever segment the annotator had selected in the UI, so it's
   * always correct even if they tag while scrubbed outside that range.
   * Undefined if the video hadn't been segmented yet when this was saved. */
  period?: string;
  createdAt: string;
  updatedAt: string;
};

type EventRow = {
  id: string;
  project_id: string;
  timestamp_seconds: number;
  team_side: TeamSide | null;
  player_id: string | null;
  event_type: EventType;
  made: boolean | null;
  shot_x: number | null;
  shot_y: number | null;
  custom_label: string | null;
  period: number | null;
  created_at: string;
  updated_at: string;
};

function mapEventRow(row: EventRow): AnnotationEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    timestampSeconds: row.timestamp_seconds,
    teamSide: row.team_side ?? undefined,
    playerId: row.player_id ?? undefined,
    eventType: row.event_type,
    made: row.made ?? undefined,
    shotLocation: row.shot_x != null && row.shot_y != null ? { x: row.shot_x, y: row.shot_y } : undefined,
    customLabel: row.custom_label ?? undefined,
    period: row.period != null ? String(row.period) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getEvents(projectId: string): Promise<AnnotationEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("annotation_events")
    .select("*")
    .eq("project_id", projectId)
    .order("timestamp_seconds", { ascending: true });
  if (error || !data) return [];
  return (data as EventRow[]).map(mapEventRow);
}

export async function deleteProjectEvents(projectId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("annotation_events").delete().eq("project_id", projectId);
}

export type NewEventInput = Omit<AnnotationEvent, "id" | "projectId" | "createdAt" | "updatedAt">;

const DUPLICATE_ERROR = "An identical event already exists at this timestamp.";

function inputToRow(projectId: string, input: NewEventInput) {
  return {
    project_id: projectId,
    timestamp_seconds: input.timestampSeconds,
    team_side: input.teamSide ?? null,
    player_id: input.playerId ?? null,
    event_type: input.eventType,
    made: input.made ?? null,
    shot_x: input.shotLocation?.x ?? null,
    shot_y: input.shotLocation?.y ?? null,
    custom_label: input.customLabel ?? null,
    period: input.period != null ? Number(input.period) : null,
  };
}

export async function createEvent(
  projectId: string,
  input: NewEventInput
): Promise<{ ok: true; event: AnnotationEvent } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("annotation_events")
    .insert(inputToRow(projectId, input))
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: DUPLICATE_ERROR };
    return { ok: false, error: error.message };
  }
  return { ok: true, event: mapEventRow(data as EventRow) };
}

export async function updateEvent(
  projectId: string,
  eventId: string,
  patch: Partial<NewEventInput>
): Promise<{ ok: true; event: AnnotationEvent } | { ok: false; error: string }> {
  const supabase = createClient();

  const updates: Record<string, unknown> = {};
  if (patch.timestampSeconds !== undefined) updates.timestamp_seconds = patch.timestampSeconds;
  // "in" rather than !== undefined — editing an event to/from Timeout
  // needs to actually clear/set these to null, not leave a stale value
  // just because the new value happens to be undefined.
  if ("teamSide" in patch) updates.team_side = patch.teamSide ?? null;
  if ("playerId" in patch) updates.player_id = patch.playerId ?? null;
  if (patch.eventType !== undefined) updates.event_type = patch.eventType;
  if ("made" in patch) updates.made = patch.made ?? null;
  if ("shotLocation" in patch) {
    updates.shot_x = patch.shotLocation?.x ?? null;
    updates.shot_y = patch.shotLocation?.y ?? null;
  }
  if ("customLabel" in patch) updates.custom_label = patch.customLabel ?? null;
  if ("period" in patch) updates.period = patch.period != null ? Number(patch.period) : null;

  const { data, error } = await supabase
    .from("annotation_events")
    .update(updates)
    .eq("id", eventId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: DUPLICATE_ERROR };
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Event not found." };
  return { ok: true, event: mapEventRow(data as EventRow) };
}

export async function deleteEvent(projectId: string, eventId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("annotation_events").delete().eq("id", eventId).eq("project_id", projectId);
}

/** Made two_point=2, three_point=3, free_throw=1; every miss and every
 * non-shot event type is 0. */
export function pointsForEvent(evt: AnnotationEvent): number {
  if (!evt.made) return 0;
  if (evt.eventType === "two_point") return 2;
  if (evt.eventType === "three_point") return 3;
  if (evt.eventType === "free_throw") return 1;
  return 0;
}

export type PlayerLiveStats = {
  playerId: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
};

/** Aggregates real tagged events into a live per-player box score for one
 * side of the game — unlike lib/portal/store.ts's getProjectResults (which
 * fabricates stats from a seeded PRNG), this reflects exactly what's been
 * tagged so far. */
export function computeLiveStats(events: AnnotationEvent[], teamSide: TeamSide): PlayerLiveStats[] {
  const byPlayer = new Map<string, PlayerLiveStats>();

  function statsFor(playerId: string): PlayerLiveStats {
    let s = byPlayer.get(playerId);
    if (!s) {
      s = { playerId, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };
      byPlayer.set(playerId, s);
    }
    return s;
  }

  for (const evt of events) {
    // Timeout (the only teamless/playerless type) never matches either
    // side and is naturally skipped here.
    if (evt.teamSide !== teamSide || !evt.playerId) continue;
    const s = statsFor(evt.playerId);
    s.pts += pointsForEvent(evt);
    if (evt.eventType === "offensive_rebound" || evt.eventType === "defensive_rebound") s.reb += 1;
    if (evt.eventType === "assist") s.ast += 1;
    if (evt.eventType === "steal") s.stl += 1;
    if (evt.eventType === "block") s.blk += 1;
    if (evt.eventType === "turnover") s.tov += 1;
    // Offensive/defensive fouls both still roll up into personal fouls
    // here — the split matters for the event log, not this stat tally.
    if (evt.eventType === "foul" || evt.eventType === "offensive_foul" || evt.eventType === "defensive_foul" || evt.eventType === "technical_foul") s.pf += 1;
  }

  return Array.from(byPlayer.values());
}
