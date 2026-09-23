/**
 * REAL, SUPABASE-BACKED PROJECT STORE
 * ─────────────────────────────────────────────────────────────────
 * Replaces the old localStorage mock. Projects, roster, and activity now
 * live in Postgres (see supabase/migrations/00000000000000_init.sql) with
 * Row Level Security enforcing who can see/edit what. Uploaded video files
 * live in the private `project-videos` Storage bucket (see
 * supabase/migrations/00000000000003_video_storage.sql), keyed by project
 * id — see uploadProjectVideo/getProjectVideoUrl below.
 *
 * The claim/assignment fields that used to live in a separate
 * lib/portal/globalProjects.ts "global index" (a workaround for
 * localStorage being siloed per browser) are now just columns on this
 * same `projects` row — RLS makes them visible to the right roles
 * directly, no separate index needed.
 */

import { createClient } from "@/lib/supabase/client";

export type ProjectStatus = "Processing" | "In Progress" | "Needs Review" | "Completed" | "Rejected";
export type AnnotationScope = "Single Team" | "Both Teams";
/** "heart_stats" projects track hustle/effort plays only (deflections,
 * loose balls, charges, screen assists, contested shots, box outs)
 * instead of a traditional box score — a separate credit pool from
 * "traditional", set once at upload time. */
export type AnnotationKind = "traditional" | "heart_stats";
export type GameFormat = "Quarters" | "Halves";
export type AnnotationStatus = "Unclaimed" | "Claimed" | "Correction Required" | "In Review" | "Completed" | "Rejected";

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
  annotationKind: AnnotationKind;
  format: GameFormat;
  roster: RosterPlayer[];
  opponentRoster?: RosterPlayer[];
  notes?: string;
  fileName?: string;
  fileSize?: string;
  videoPath?: string;
  /** True once the raw source was deleted from R2 after every period had
   * a real cut clip (see clearProjectVideoSource) — distinct from a
   * project that simply never had a real upload, which also has no
   * videoPath but this stays false, so the UI can tell the two apart. */
  videoCleared: boolean;
  status: ProjectStatus;
  progress: number;
  officialScore?: OfficialScore;
  annotationStatus: AnnotationStatus;
  claimedBy?: string;
  claimedByName?: string;
  claimedAt?: string;
  submissionNote?: string;
  rejectionReason?: string;
  /** Admin-entered explanation for an official/tagged score mismatch —
   * distinct from submissionNote, which is the annotator's own note to
   * QA. Shown to the client alongside the score check. */
  scoreCheckNote?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityEntry = {
  id: string;
  text: string;
  time: string;
};

type RosterRow = { id: string; project_id: string; side: "team" | "opponent"; number: string; name: string; sort_order: number };

type ProjectRow = {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  opponent: string | null;
  game_date: string | null;
  scope: AnnotationScope;
  annotation_kind: AnnotationKind;
  format: GameFormat;
  notes: string | null;
  file_name: string | null;
  file_size: string | null;
  video_path: string | null;
  video_cleared: boolean;
  status: ProjectStatus;
  progress: number;
  official_score_team: number | null;
  official_score_opponent: number | null;
  annotation_status: AnnotationStatus;
  claimed_by: string | null;
  claimed_by_name: string | null;
  claimed_at: string | null;
  submission_note: string | null;
  rejection_reason: string | null;
  score_check_note: string | null;
  completed_at: string | null;
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
    annotationKind: row.annotation_kind,
    format: row.format,
    roster: toRosterPlayers(row.roster_players, "team"),
    opponentRoster: row.scope === "Both Teams" ? opponentRoster : undefined,
    notes: row.notes ?? undefined,
    fileName: row.file_name ?? undefined,
    fileSize: row.file_size ?? undefined,
    videoPath: row.video_path ?? undefined,
    videoCleared: row.video_cleared,
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
    rejectionReason: row.rejection_reason ?? undefined,
    scoreCheckNote: row.score_check_note ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PROJECT_SELECT = "*";

/** Fetches roster_players for a batch of projects as a SEPARATE query and
 * attaches them, rather than a nested `projects.select("*, roster_players(*)")`
 * embed — that embed, combined with RLS on both tables, was silently
 * flattening the result into one duplicate top-level project row per
 * roster player (a project with 3 players showed up 3 times) any time
 * the query ran through the normal RLS-scoped client. Confirmed via a
 * direct comparison: the same embedded query returned correctly
 * (one row per project) through the service-role client, which
 * bypasses RLS entirely — so this is an RLS+embed interaction, not a
 * plain PostgREST bug, and the robust fix is to just not rely on that
 * embed for aggregation at all. */
async function attachRosters<T extends { id: string }>(rows: T[]): Promise<(T & { roster_players: RosterRow[] })[]> {
  if (rows.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("roster_players")
    .select("*")
    .in("project_id", rows.map((r) => r.id));
  const byProject = new Map<string, RosterRow[]>();
  for (const r of (data as RosterRow[] | null) ?? []) {
    const list = byProject.get(r.project_id) ?? [];
    list.push(r);
    byProject.set(r.project_id, list);
  }
  return rows.map((r) => ({ ...r, roster_players: byProject.get(r.id) ?? [] }));
}

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
  const withRosters = await attachRosters(data as unknown as Omit<ProjectRow, "roster_players">[]);
  return withRosters.map(mapProjectRow);
}

export async function getProject(projectId: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).eq("id", projectId).single();
  if (error || !data) return null;
  const [withRoster] = await attachRosters([data as unknown as Omit<ProjectRow, "roster_players">]);
  return mapProjectRow(withRoster);
}

/** The shared placeholder every workspace played before Phase 2 — still
 * the fallback for any project with no real video attached (pre-Phase-2
 * demo projects, or one whose upload never completed). */
const SAMPLE_VIDEO_SRC = "/annotator-sample.mp4";

export type UploadProgress = { loadedBytes: number; totalBytes: number };

/** PUTs a file to a presigned URL via XMLHttpRequest rather than fetch —
 * fetch has no upload-progress event, only XHR does, and the upload page
 * needs real percentage/speed/ETA rather than a fake spinner. */
function putWithProgress(url: string, file: File, onProgress?: (p: UploadProgress) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.({ loadedBytes: e.loaded, totalBytes: e.total });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (status ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload failed — network error."));
    xhr.send(file);
  });
}

/**
 * Uploads a project's real game film to Cloudflare R2 (private bucket,
 * accessed only via short-lived presigned URLs — see
 * app/api/videos/upload-url/route.ts) and records the resulting object
 * key on the project row. A separate step from createProject because
 * the upload-url route needs the project row to already exist, to
 * verify the caller actually owns it before issuing a presigned URL.
 */
export async function uploadProjectVideo(
  projectId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  const urlRes = await fetch("/api/videos/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, fileName: file.name, contentType: file.type, fileSize: file.size }),
  });
  const urlData = await urlRes.json();
  if (!urlRes.ok) return { ok: false, error: urlData.error ?? "Couldn't prepare the upload." };

  try {
    await putWithProgress(urlData.url, file, onProgress);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }

  const supabase = createClient();
  const { error: updateError } = await supabase.from("projects").update({ video_path: urlData.key }).eq("id", projectId);
  if (updateError) return { ok: false, error: updateError.message };

  return { ok: true };
}

/** A playable URL for a project's video — a real signed URL if it has
 * one uploaded, otherwise the shared sample clip fallback. Centralized
 * here so every place that plays a project's video (annotator workspace,
 * admin QA review) applies the same fallback rule. */
export async function getProjectVideoUrl(project: Project): Promise<string> {
  if (!project.videoPath) return SAMPLE_VIDEO_SRC;

  const res = await fetch("/api/videos/playback-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: project.id, key: project.videoPath }),
  });
  if (!res.ok) return SAMPLE_VIDEO_SRC;
  const { url } = await res.json();
  return url ?? SAMPLE_VIDEO_SRC;
}

/** Deletes a project's raw source video from R2 (not its period clips)
 * and records that on the row — called once from
 * lib/portal/pipeline.ts's approveAndComplete, only after confirming
 * every period already has a real clip. Only nulls video_path once the
 * R2 delete has actually succeeded, so a failed delete never leaves a
 * dangling pointer to a file that's still really there. */
export async function clearProjectVideoSource(projectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/videos/delete-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Couldn't delete the source video." };

  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({ video_path: null, video_cleared: true })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
  const withRosters = await attachRosters(data as unknown as Omit<ProjectRow, "roster_players">[]);
  return withRosters.map(mapProjectRow);
}

/** Admin-only: permanently deletes a project, its R2 video/clip files,
 * and (via existing foreign keys) its roster, events, and segments.
 * See app/api/videos/delete-project/route.ts for the actual admin
 * verification and R2 cleanup — this is just the client-side call. */
export async function deleteProject(projectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/videos/delete-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Couldn't delete the project." };
  return { ok: true };
}

/** Admin-only: records why an official/tagged score mismatch exists
 * (relies on the "admins full access to projects" RLS policy already
 * in place — no new RPC needed). */
export async function updateScoreCheckNote(projectId: string, note: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("projects").update({ score_check_note: note.trim() || null }).eq("id", projectId);
}

/** Games this annotator worked on that reached Completed status within
 * the current calendar week — not just any tagging activity. Resets
 * naturally to 0 each week since it's computed live, not stored. */
export async function getGamesAnnotatedThisWeek(annotatorId: string): Promise<number> {
  const supabase = createClient();
  const weekStart = new Date();
  const day = weekStart.getDay();
  // getDay(): 0=Sun..6=Sat — roll back to Monday (ISO week start).
  const diffToMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("claimed_by", annotatorId)
    .eq("annotation_status", "Completed")
    .gte("completed_at", weekStart.toISOString());

  return count ?? 0;
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

export type AuditLogEntry = {
  id: string;
  actorName: string;
  actorRole: string;
  summary: string;
  createdAt: string;
};

/** Admin-only (matches the "audit logs visible to admin" RLS policy) —
 * every status transition and every scoring-relevant event change for
 * a project, newest first. See supabase/migrations/
 * 00000000000015_correction_required.sql for what actually writes
 * these rows. */
export async function getAuditLog(projectId: string): Promise<AuditLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, actor_name, actor_role, summary, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((a) => ({
    id: a.id,
    actorName: a.actor_name,
    actorRole: a.actor_role,
    summary: a.summary,
    createdAt: a.created_at,
  }));
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
    annotationKind?: AnnotationKind;
    format: GameFormat;
    roster: RosterPlayer[];
    opponentRoster?: RosterPlayer[];
    notes?: string;
    fileName?: string;
    fileSize?: string;
    /** Absent for Heart Stats projects — there's no official score to
     * check a hustle-stat-only annotation against. */
    officialScore?: OfficialScore;
  },
  ownerName: string
): Promise<{ ok: true; project: Project } | { ok: false; error: string }> {
  const supabase = createClient();
  const annotationKind = input.annotationKind ?? "traditional";

  // Consumed BEFORE creating the project, not after-then-rolled-back —
  // clients have no delete permission on projects at all (RLS enforces
  // this — see supabase/migrations/00000000000020_rls_hardening.sql —
  // deletion is deliberately admin-only elsewhere in this app), so
  // failing early here avoids ever needing one just for this rollback case.
  const { data: hasCredit, error: creditError } = await supabase.rpc("consume_game_credit", {
    target_scope: input.scope,
    target_kind: annotationKind,
  });
  if (creditError) {
    return { ok: false, error: creditError.message };
  }
  if (!hasCredit) {
    const kindLabel = annotationKind === "heart_stats" ? "Heart Stats" : "";
    return {
      ok: false,
      error: `No ${input.scope} ${kindLabel} game credits available — buy more games on the Billing page.`,
    };
  }

  const { data: projectRow, error } = await supabase
    .from("projects")
    .insert({
      owner_id: userId,
      owner_name: ownerName,
      name: input.name,
      opponent: input.opponent,
      game_date: input.gameDate || null,
      scope: input.scope,
      annotation_kind: annotationKind,
      format: input.format,
      notes: input.notes,
      file_name: input.fileName,
      file_size: input.fileSize,
      official_score_team: input.officialScore?.team ?? null,
      official_score_opponent: input.officialScore?.opponent ?? null,
    })
    .select()
    .single();

  if (error || !projectRow) {
    console.error("createProject failed:", error);
    return { ok: false, error: error?.message ?? "Unknown error creating project." };
  }

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

  const project = await getProject(projectRow.id);
  if (!project) return { ok: false, error: "Project was created but couldn't be re-fetched." };
  return { ok: true, project };
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
  minSeconds: number;
  plusMinus: number;
};

export type TaggedClip = {
  id: string;
  label: string;
  time: string;
  player: string;
  confidence: number;
  verified?: boolean;
  /** Set only when this event's period was cut into a real clip (Phase 3)
   * — the client Results page seeks into that clip rather than showing
   * the "not available" placeholder. */
  clipPath?: string;
  clipOffsetSeconds?: number;
};

export type ShotChartPoint = { x: number; y: number; made: boolean };

export type ProjectResults = {
  team: PlayerBoxScore[];
  opponent?: PlayerBoxScore[];
  clips: TaggedClip[];
  teamShots: ShotChartPoint[];
  opponentShots?: ShotChartPoint[];
};

/** Per-player tally for a Heart Stats project — no minutes/+/- (no
 * substitutions are meaningfully tracked without a full box score's
 * game clock discipline), just raw hustle-play counts. */
export type PlayerHeartStatsBoxScore = {
  number: string;
  name: string;
  deflections: number;
  looseBallsRecovered: number;
  chargesDrawn: number;
  screenAssists: number;
  contestedShots: number;
  boxOutsWon: number;
  boxOutsAttempted: number;
};

export type HeartStatsResults = {
  team: PlayerHeartStatsBoxScore[];
  opponent?: PlayerHeartStatsBoxScore[];
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
    minSeconds: Math.floor((4 + rand() * 28) * 60),
    plusMinus: Math.round((rand() - 0.5) * 30),
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

function genShots(rand: () => number): ShotChartPoint[] {
  const count = 8 + Math.floor(rand() * 10);
  const shots: ShotChartPoint[] = [];
  for (let i = 0; i < count; i++) {
    // Biased toward one basket's key/three-point area rather than
    // uniform-random, so the fabricated chart looks plausible.
    const nearLeft = rand() < 0.5;
    const x = nearLeft ? rand() * 0.35 : 0.65 + rand() * 0.35;
    const y = 0.15 + rand() * 0.7;
    shots.push({ x, y, made: rand() < 0.45 });
  }
  return shots;
}

export function getProjectResults(project: Project): ProjectResults {
  const rand = seededRandom(project.id);
  const team = project.roster.map((p) => genPlayerStats(p, rand));
  const opponent =
    project.opponentRoster && project.opponentRoster.length > 0
      ? project.opponentRoster.map((p) => genPlayerStats(p, rand))
      : undefined;
  const clips = genClips(project, rand);
  const teamShots = genShots(rand);
  const opponentShots = opponent ? genShots(rand) : undefined;
  return { team, opponent, clips, teamShots, opponentShots };
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
