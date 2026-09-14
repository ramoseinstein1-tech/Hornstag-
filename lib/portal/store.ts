/**
 * REAL, SUPABASE-BACKED PROJECT STORE
 * ─────────────────────────────────────────────────────────────────
 * Replaces the old localStorage mock. Projects, roster, and activity now
 * live in Postgres (see supabase/migrations/00000000000000_init.sql) with
 * Row Level Security enforcing who can see/edit what. Uploaded video
 * files still aren't actually stored anywhere yet (Phase 2 of the
 * backend migration) — only the file's name/size are recorded so the UI
 * can show something real.
 *
 * The claim/assignment fields that used to live in a separate
 * lib/portal/globalProjects.ts "global index" (a workaround for
 * localStorage being siloed per browser) are now just columns on this
 * same `projects` row — RLS makes them visible to the right roles
 * directly, no separate index needed.
 */

import { createClient } from "@/lib/supabase/client";

export type ProjectStatus = "Processing" | "In Progress" | "Needs Review" | "Completed";
export type AnnotationScope = "Single Team" | "Both Teams";
export type GameFormat = "Quarters" | "Halves";
export type AnnotationStatus = "Unclaimed" | "Claimed" | "In Review" | "Completed";

export type RosterPlayer = {
  id: string;
  number: string;
  name: string;
};

export type OfficialScore = {
  team: number;
  opponent: number;
};

/** "team" | "opponent" if one side outscored the other, else "tie". */
export function officialOutcome(score: OfficialScore): "team" | "opponent" | "tie" {
  if (score.team > score.opponent) return "team";
  if (score.opponent > score.team) return "opponent";
  return "tie";
}

export type Project = {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  opponent?: string;
  gameDate?: string;
  scope: AnnotationScope;
  format: GameFormat;
  roster: RosterPlayer[];
  opponentRoster?: RosterPlayer[];
  notes?: string;
  fileName?: string;
  fileSize?: string;
  status: ProjectStatus;
  progress: number;
  officialScore?: OfficialScore;
  annotationStatus: AnnotationStatus;
  claimedBy?: string;
  claimedByName?: string;
  claimedAt?: string;
  submissionNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityEntry = {
  id: string;
  text: string;
  time: string;
};

type RosterRow = { id: string; side: "team" | "opponent"; number: string; name: string; sort_order: number };

type ProjectRow = {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  opponent: string | null;
  game_date: string | null;
  scope: AnnotationScope;
  format: GameFormat;
  notes: string | null;
  file_name: string | null;
  file_size: string | null;
  status: ProjectStatus;
  progress: number;
  official_score_team: number | null;
  official_score_opponent: number | null;
  annotation_status: AnnotationStatus;
  claimed_by: string | null;
  claimed_by_name: string | null;
  claimed_at: string | null;
  submission_note: string | null;
  created_at: string;
  updated_at: string;
  roster_players: RosterRow[];
};

function toRosterPlayers(rows: RosterRow[], side: "team" | "opponent"): RosterPlayer[] {
  return rows
    .filter((r) => r.side === side)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({ id: r.id, number: r.number, name: r.name }));
}

function mapProjectRow(row: ProjectRow): Project {
  const opponentRoster = toRosterPlayers(row.roster_players, "opponent");
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    name: row.name,
    opponent: row.opponent ?? undefined,
    gameDate: row.game_date ?? undefined,
    scope: row.scope,
    format: row.format,
    roster: toRosterPlayers(row.roster_players, "team"),
    opponentRoster: row.scope === "Both Teams" ? opponentRoster : undefined,
    notes: row.notes ?? undefined,
    fileName: row.file_name ?? undefined,
    fileSize: row.file_size ?? undefined,
    status: row.status,
    progress: row.progress,
    officialScore:
      row.official_score_team != null && row.official_score_opponent != null
        ? { team: row.official_score_team, opponent: row.official_score_opponent }
        : undefined,
    annotationStatus: row.annotation_status,
    claimedBy: row.claimed_by ?? undefined,
    claimedByName: row.claimed_by_name ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
    submissionNote: row.submission_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PROJECT_SELECT = "*, roster_players(*)";

/** Every project a CLIENT owns. RLS already restricts this to their own
 * rows, but filtering by owner_id here too keeps the query intent clear. */
export async function getProjects(userId: string): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as ProjectRow[]).map(mapProjectRow);
}

export async function getProject(projectId: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).eq("id", projectId).single();
  if (error || !data) return null;
  return mapProjectRow(data as unknown as ProjectRow);
}

/** Every project visible to the CALLER's role — for a client, just their
 * own (same as getProjects); for an annotator, Unclaimed projects plus
 * anything claimed_by them; for an admin, everything. Which rows come
 * back is entirely up to RLS — this function doesn't filter by role
 * itself, it just asks for "all projects I'm allowed to see." */
export async function getVisibleProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as ProjectRow[]).map(mapProjectRow);
}

export async function getActivity(userId: string): Promise<ActivityEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, text, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((a) => ({ id: a.id, text: a.text, time: a.created_at }));
}

/** Adds an entry to a client's activity feed from OUTSIDE their own
 * session — used by lib/portal/pipeline.ts's approveAndComplete, which
 * runs as the admin, via the approve_and_complete RPC (which does the
 * insert itself, server-side) — this direct-insert version exists for
 * any other same-purpose caller and relies on activity_log's RLS. */
export async function addActivity(userId: string, text: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("activity_log").insert({ user_id: userId, text });
}

/**
 * Replaces a project's roster wholesale (both the "team" and, for
 * Both-Teams projects, "opponent" sides) — used by both the client's
 * upload/edit flow and the annotator's in-workspace roster fixes (RLS
 * permits both the owner and the assigned annotator to write here).
 * Deletes the old rows and inserts the new list rather than diffing,
 * since callers always pass the complete edited roster.
 */
export async function updateRoster(
  projectId: string,
  roster: RosterPlayer[],
  opponentRoster?: RosterPlayer[]
): Promise<Project | null> {
  const supabase = createClient();

  await supabase.from("roster_players").delete().eq("project_id", projectId).eq("side", "team");
  if (roster.length > 0) {
    await supabase.from("roster_players").insert(
      roster.map((p, i) => ({ id: p.id, project_id: projectId, side: "team", number: p.number, name: p.name, sort_order: i }))
    );
  }

  if (opponentRoster !== undefined) {
    await supabase.from("roster_players").delete().eq("project_id", projectId).eq("side", "opponent");
    if (opponentRoster.length > 0) {
      await supabase.from("roster_players").insert(
        opponentRoster.map((p, i) => ({ id: p.id, project_id: projectId, side: "opponent", number: p.number, name: p.name, sort_order: i }))
      );
    }
  }

  return getProject(projectId);
}

export async function createProject(
  userId: string,
  input: {
    name: string;
    opponent?: string;
    gameDate?: string;
    scope: AnnotationScope;
    format: GameFormat;
    roster: RosterPlayer[];
    opponentRoster?: RosterPlayer[];
    notes?: string;
    fileName?: string;
    fileSize?: string;
    officialScore: OfficialScore;
  },
  ownerName: string
): Promise<Project | null> {
  const supabase = createClient();

  const { data: projectRow, error } = await supabase
    .from("projects")
    .insert({
      owner_id: userId,
      owner_name: ownerName,
      name: input.name,
      opponent: input.opponent,
      game_date: input.gameDate || null,
      scope: input.scope,
      format: input.format,
      notes: input.notes,
      file_name: input.fileName,
      file_size: input.fileSize,
      official_score_team: input.officialScore.team,
      official_score_opponent: input.officialScore.opponent,
    })
    .select()
    .single();

  if (error || !projectRow) return null;

  if (input.roster.length > 0) {
    await supabase.from("roster_players").insert(
      input.roster.map((p, i) => ({ id: p.id, project_id: projectRow.id, side: "team", number: p.number, name: p.name, sort_order: i }))
    );
  }
  if (input.opponentRoster && input.opponentRoster.length > 0) {
    await supabase.from("roster_players").insert(
      input.opponentRoster.map((p, i) => ({ id: p.id, project_id: projectRow.id, side: "opponent", number: p.number, name: p.name, sort_order: i }))
    );
  }

  await addActivity(userId, `Uploaded new game film: "${input.name}"`);

  return getProject(projectRow.id);
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  return `${diffDay} days ago`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * FAKE RESULTS GENERATION (fallback only)
 * ─────────────────────────────────────────────────────────────────
 * lib/portal/results.ts's computeRealResults() is the real source of
 * truth once a project has actual tagged events. This deterministic
 * seeded-PRNG generator only exists as a fallback for the 3 hardcoded
 * demo/seed projects (which predate real annotation and have zero real
 * events behind them) so they keep looking intentional instead of
 * showing an empty box score.
 */

export type PlayerBoxScore = {
  number: string;
  name: string;
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
};

export type TaggedClip = {
  id: string;
  label: string;
  time: string;
  player: string;
  confidence: number;
  verified?: boolean;
};

export type ProjectResults = {
  team: PlayerBoxScore[];
  opponent?: PlayerBoxScore[];
  clips: TaggedClip[];
};

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function genPlayerStats(p: RosterPlayer, rand: () => number): PlayerBoxScore {
  const fga = 4 + Math.floor(rand() * 12);
  const fgm = Math.min(fga, Math.round(fga * (0.32 + rand() * 0.28)));
  const tpa = Math.floor(rand() * 7);
  const tpm = Math.min(tpa, Math.round(tpa * (0.2 + rand() * 0.3)));
  const ftBonus = Math.floor(rand() * 6);

  return {
    number: p.number,
    name: p.name,
    pts: fgm * 2 + tpm + ftBonus,
    reb: Math.floor(rand() * 11),
    ast: Math.floor(rand() * 9),
    stl: Math.floor(rand() * 4),
    blk: Math.floor(rand() * 3),
    tov: Math.floor(rand() * 5),
    fgm,
    fga,
    tpm,
    tpa,
  };
}

const EVENT_POOL = ["SHOT ATTEMPT", "3PT MADE", "REBOUND", "ASSIST", "STEAL", "BLOCK", "TURNOVER", "FOUL"];

function genClips(project: Project, rand: () => number): TaggedClip[] {
  const players = [...project.roster, ...(project.opponentRoster ?? [])];
  if (players.length === 0) return [];

  const periods = project.format === "Halves" ? ["1H", "2H"] : ["Q1", "Q2", "Q3", "Q4"];
  const count = 6 + Math.floor(rand() * 5);
  const clips: TaggedClip[] = [];

  for (let i = 0; i < count; i++) {
    const player = players[Math.floor(rand() * players.length)];
    const period = periods[Math.floor(rand() * periods.length)];
    const minutes = String(Math.floor(rand() * 12)).padStart(2, "0");
    const seconds = String(Math.floor(rand() * 60)).padStart(2, "0");
    clips.push({
      id: `clip-${i}`,
      label: EVENT_POOL[Math.floor(rand() * EVENT_POOL.length)],
      time: `${period} ${minutes}:${seconds}`,
      player: `#${player.number} ${player.name}`,
      confidence: Math.round((90 + rand() * 9.5) * 10) / 10,
    });
  }

  return clips;
}

export function getProjectResults(project: Project): ProjectResults {
  const rand = seededRandom(project.id);
  const team = project.roster.map((p) => genPlayerStats(p, rand));
  const opponent =
    project.opponentRoster && project.opponentRoster.length > 0
      ? project.opponentRoster.map((p) => genPlayerStats(p, rand))
      : undefined;
  const clips = genClips(project, rand);
  return { team, opponent, clips };
}

export function teamTotals(players: PlayerBoxScore[]) {
  const sum = (key: keyof PlayerBoxScore) =>
    players.reduce((acc, p) => acc + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);
  const fgm = sum("fgm");
  const fga = sum("fga");
  const tpm = sum("tpm");
  const tpa = sum("tpa");

  return {
    pts: sum("pts"),
    reb: sum("reb"),
    ast: sum("ast"),
    stl: sum("stl"),
    blk: sum("blk"),
    tov: sum("tov"),
    fgm,
    fga,
    tpm,
    tpa,
    fgPct: fga > 0 ? Math.round((fgm / fga) * 1000) / 10 : 0,
    tpPct: tpa > 0 ? Math.round((tpm / tpa) * 1000) / 10 : 0,
  };
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
