/**
 * MOCK, CLIENT-SIDE PROJECT STORE
 * ─────────────────────────────────────────────────────────────────
 * Same story as lib/auth/mockAuthStore.ts — there's no backend yet, so
 * this persists projects/activity per-user in localStorage. Uploaded
 * video files are NOT actually stored anywhere (there's no server to
 * receive them); only the file's name/size are recorded so the UI can
 * show something real. Replace with real API routes + object storage
 * (S3/R2/etc.) before this handles real uploads.
 */

import { publishProjectToGlobalIndex } from "./globalProjects";

export type ProjectStatus = "Processing" | "In Progress" | "Needs Review" | "Completed";
export type AnnotationScope = "Single Team" | "Both Teams";
export type GameFormat = "Quarters" | "Halves";

export type RosterPlayer = {
  id: string;
  number: string;
  name: string;
};

/** The final score the client reports at upload time — the ground truth
 * the annotator's tagged events are checked against during QA. Optional
 * on the type only because pre-existing (seed/legacy) records predate
 * this field; every NEW project requires it (enforced by the upload
 * form, not this type). */
export type OfficialScore = {
  team: number;
  opponent: number;
};

export type Project = {
  id: string;
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
  createdAt: string;
  updatedAt: string;
};

/** "team" | "opponent" if one side outscored the other, else "tie". */
export function officialOutcome(score: OfficialScore): "team" | "opponent" | "tie" {
  if (score.team > score.opponent) return "team";
  if (score.opponent > score.team) return "opponent";
  return "tie";
}

export type ActivityEntry = {
  id: string;
  text: string;
  time: string;
};

type PortalData = {
  projects: Project[];
  activity: ActivityEntry[];
};

// Bumped to v2 when the Project shape changed (level/priority ->
// scope/format/roster), then to v3 when RosterPlayer gained a stable `id`
// (needed so annotation events can reference a specific player instead of
// reconstructing identity from "${number}-${name}" strings). Unlike the
// v1->v2 bump, v2->v3 is migrated in place (see migrateV2ToV3) rather than
// just reseeded, since real client-uploaded rosters shouldn't be wiped by
// a purely additive field.
const KEY_PREFIX = "hornstag_portal_v3_";
const KEY_PREFIX_V2 = "hornstag_portal_v2_";

function isBrowser() {
  return typeof window !== "undefined";
}

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function keyV2(userId: string) {
  return `${KEY_PREFIX_V2}${userId}`;
}

function seedData(): PortalData {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

  return {
    projects: [
      {
        id: "seed-1",
        name: "Hawks vs. Celtics — Full Game",
        opponent: "vs. Celtics",
        scope: "Both Teams",
        format: "Quarters",
        roster: [
          { id: "seed-1-p1", number: "23", name: "J. Carter" },
          { id: "seed-1-p2", number: "11", name: "D. Nguyen" },
          { id: "seed-1-p3", number: "04", name: "M. Osei" },
        ],
        opponentRoster: [
          { id: "seed-1-o1", number: "7", name: "T. Brooks" },
          { id: "seed-1-o2", number: "15", name: "R. Silva" },
        ],
        status: "In Progress",
        progress: 62,
        officialScore: { team: 78, opponent: 71 },
        createdAt: hoursAgo(30),
        updatedAt: hoursAgo(2),
      },
      {
        id: "seed-2",
        name: "U18 Regional Semifinal",
        scope: "Single Team",
        format: "Halves",
        roster: [
          { id: "seed-2-p1", number: "32", name: "A. Patel" },
          { id: "seed-2-p2", number: "09", name: "K. Reyes" },
        ],
        status: "Needs Review",
        progress: 100,
        officialScore: { team: 64, opponent: 59 },
        createdAt: hoursAgo(48),
        updatedAt: hoursAgo(24),
      },
      {
        id: "seed-3",
        name: "Scouting Reel — G. Martinez",
        scope: "Single Team",
        format: "Quarters",
        roster: [{ id: "seed-3-p1", number: "05", name: "G. Martinez" }],
        status: "Completed",
        progress: 100,
        officialScore: { team: 82, opponent: 75 },
        createdAt: hoursAgo(96),
        updatedAt: hoursAgo(72),
      },
    ],
    activity: [
      { id: "seed-a1", text: 'QA pass completed on "Hawks vs. Celtics"', time: hoursAgo(2) },
      { id: "seed-a2", text: '42 new events annotated in "U18 Regional Semifinal"', time: hoursAgo(5) },
      { id: "seed-a3", text: '"Scouting Reel — G. Martinez" marked complete', time: hoursAgo(72) },
      { id: "seed-a4", text: 'Uploaded new game film: "Hawks vs. Celtics"', time: hoursAgo(96) },
    ],
  };
}

function isValidShape(data: unknown): data is PortalData {
  if (!data || typeof data !== "object") return false;
  const { projects } = data as PortalData;
  if (!Array.isArray(projects)) return false;
  // Spot-check every record against the current Project shape (including
  // the v3 roster `id` field) so a schema change we forgot to version-bump
  // self-heals instead of crashing the page on a missing field.
  return projects.every(
    (p) =>
      typeof p.scope === "string" &&
      typeof p.format === "string" &&
      Array.isArray(p.roster) &&
      p.roster.every((r) => typeof r.id === "string") &&
      (p.opponentRoster === undefined ||
        (Array.isArray(p.opponentRoster) && p.opponentRoster.every((r) => typeof r.id === "string")))
  );
}

/** Migrates a pre-v3 record forward by synthesizing an id for any roster
 * player that doesn't already have one, rather than discarding the data —
 * unlike the v1->v2 bump, this field is purely additive so there's no
 * reason to reseed a client's real uploaded projects. Returns null if
 * there's no v2 data to migrate. */
function migrateV2ToV3(userId: string): PortalData | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(keyV2(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.projects)) return null;

    const withIds = (roster: unknown): RosterPlayer[] =>
      Array.isArray(roster)
        ? roster.map((r: Partial<RosterPlayer>) => ({
            id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
            number: r.number ?? "",
            name: r.name ?? "",
          }))
        : [];

    const migrated: PortalData = {
      projects: parsed.projects.map((p: Project & { roster: unknown; opponentRoster?: unknown }) => ({
        ...p,
        roster: withIds(p.roster),
        opponentRoster: p.opponentRoster ? withIds(p.opponentRoster) : p.opponentRoster,
      })),
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
    };
    return migrated;
  } catch {
    return null;
  }
}

function readData(userId: string): PortalData {
  if (!isBrowser()) return { projects: [], activity: [] };
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidShape(parsed)) return parsed;
    }
  } catch {
    // Corrupt data — fall through and try migrating, then reseed.
  }

  const migrated = migrateV2ToV3(userId);
  if (migrated && isValidShape(migrated)) {
    writeData(userId, migrated);
    window.localStorage.removeItem(keyV2(userId));
    return migrated;
  }

  const seeded = seedData();
  writeData(userId, seeded);
  return seeded;
}

function writeData(userId: string, data: PortalData) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key(userId), JSON.stringify(data));
}

export function getProjects(userId: string): Project[] {
  return readData(userId).projects;
}

export function getActivity(userId: string): ActivityEntry[] {
  return readData(userId).activity;
}

/** Adds an entry to a client's activity feed from OUTSIDE their own
 * session — used by lib/portal/pipeline.ts so a client actually sees a
 * concrete, visible signal on their dashboard when QA completes a
 * project, rather than having to guess results are ready by refreshing
 * the Results page. Same same-browser-localStorage caveat as the rest of
 * this file's cross-role writes (see updateRoster/setProjectStatus). */
export function addActivity(userId: string, text: string): void {
  const data = readData(userId);
  data.activity = [{ id: crypto.randomUUID(), text, time: new Date().toISOString() }, ...data.activity];
  writeData(userId, data);
}

export function deleteUserData(userId: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key(userId));
}

/**
 * Updates a project's roster from OUTSIDE the owning client's own session —
 * used by the annotator workspace, since annotators need to fix/extend a
 * roster while tagging (a jersey number typo, a player the client forgot).
 * Writes directly into the owning client's localStorage bucket, which only
 * works because this is all same-browser localStorage with no real access
 * control (see the file-level comment above) — not a security boundary.
 */
export function updateRoster(
  ownerId: string,
  projectId: string,
  roster: RosterPlayer[],
  opponentRoster?: RosterPlayer[]
): Project | null {
  const data = readData(ownerId);
  const idx = data.projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return null;

  data.projects[idx] = {
    ...data.projects[idx],
    roster,
    opponentRoster: data.projects[idx].scope === "Both Teams" ? opponentRoster : data.projects[idx].opponentRoster,
    updatedAt: new Date().toISOString(),
  };
  writeData(ownerId, data);
  return data.projects[idx];
}

/**
 * Updates a project's client-facing status/progress from OUTSIDE the
 * owning client's own session — called by lib/portal/pipeline.ts to keep
 * this mirrored with the annotation-side GlobalAnnotationStatus, so the
 * client's own Results page (which gates on `status`) actually reflects
 * real pipeline progress instead of staying frozen at "Processing"
 * forever (its only previous value, set once at createProject()).
 */
export function setProjectStatus(
  ownerId: string,
  projectId: string,
  status: ProjectStatus,
  progress?: number
): Project | null {
  const data = readData(ownerId);
  const idx = data.projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return null;

  data.projects[idx] = {
    ...data.projects[idx],
    status,
    progress: progress ?? data.projects[idx].progress,
    updatedAt: new Date().toISOString(),
  };
  writeData(ownerId, data);
  return data.projects[idx];
}

export function createProject(
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
  ownerName?: string
): Project {
  const data = readData(userId);
  const now = new Date().toISOString();

  const project: Project = {
    id: crypto.randomUUID(),
    name: input.name,
    opponent: input.opponent,
    gameDate: input.gameDate,
    scope: input.scope,
    format: input.format,
    roster: input.roster,
    opponentRoster: input.opponentRoster,
    notes: input.notes,
    fileName: input.fileName,
    fileSize: input.fileSize,
    officialScore: input.officialScore,
    status: "Processing",
    progress: 4,
    createdAt: now,
    updatedAt: now,
  };

  const activityEntry: ActivityEntry = {
    id: crypto.randomUUID(),
    text: `Uploaded new game film: "${input.name}"`,
    time: now,
  };

  data.projects = [project, ...data.projects];
  data.activity = [activityEntry, ...data.activity];
  writeData(userId, data);

  // Publishes a lightweight pointer to this project so an Annotator (a
  // different account, same browser) can find it to claim — see
  // lib/portal/globalProjects.ts for the same-browser-only caveat.
  publishProjectToGlobalIndex({
    projectId: project.id,
    ownerId: userId,
    ownerName: ownerName ?? "Unknown",
    createdAt: now,
  });

  return project;
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
 * MOCK RESULTS GENERATION
 * ─────────────────────────────────────────────────────────────────
 * There's no computer-vision pipeline behind this demo, so box scores
 * and tagged clips are generated deterministically from the project's
 * own roster and id (same project always produces the same "results" —
 * it just isn't re-randomized on every render). Replace with real
 * annotation output once a backend exists.
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
  /** True only for a REAL, annotator-tagged clip (see lib/portal/results.ts)
   * — lets ClipCard show "verified" instead of a meaningless fake
   * confidence score. Always undefined for this file's own fake genClips(). */
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

  // fgm/fga are ALL field goals (2s and 3s combined, standard box-score
  // convention), with tpm/tpa the 3-point subset. Points = 2pt makes*2 +
  // 3pt makes*3 = (fgm-tpm)*2 + tpm*3, which simplifies to fgm*2 + tpm.
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

const EVENT_POOL = [
  "SHOT ATTEMPT",
  "3PT MADE",
  "REBOUND",
  "ASSIST",
  "STEAL",
  "BLOCK",
  "TURNOVER",
  "FOUL",
];

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
  if (!isBrowser()) return;
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
