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

export type ProjectStatus = "Processing" | "In Progress" | "Needs Review" | "Completed";
export type AnnotationScope = "Single Team" | "Both Teams";
export type GameFormat = "Quarters" | "Halves";

export type RosterPlayer = {
  number: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
};

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
// scope/format/roster). Bump again any time Project's shape changes in a
// way older stored records won't satisfy — old keys are simply orphaned
// and harmless, and everyone gets fresh, correctly-shaped seed data.
const KEY_PREFIX = "hornstag_portal_v2_";

function isBrowser() {
  return typeof window !== "undefined";
}

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`;
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
          { number: "23", name: "J. Carter" },
          { number: "11", name: "D. Nguyen" },
          { number: "04", name: "M. Osei" },
        ],
        opponentRoster: [
          { number: "7", name: "T. Brooks" },
          { number: "15", name: "R. Silva" },
        ],
        status: "In Progress",
        progress: 62,
        createdAt: hoursAgo(30),
        updatedAt: hoursAgo(2),
      },
      {
        id: "seed-2",
        name: "U18 Regional Semifinal",
        scope: "Single Team",
        format: "Halves",
        roster: [
          { number: "32", name: "A. Patel" },
          { number: "09", name: "K. Reyes" },
        ],
        status: "Needs Review",
        progress: 100,
        createdAt: hoursAgo(48),
        updatedAt: hoursAgo(24),
      },
      {
        id: "seed-3",
        name: "Scouting Reel — G. Martinez",
        scope: "Single Team",
        format: "Quarters",
        roster: [{ number: "05", name: "G. Martinez" }],
        status: "Completed",
        progress: 100,
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
  // Spot-check the first record against the current Project shape so a
  // schema change we forgot to version-bump self-heals instead of
  // crashing the page on a missing field.
  return projects.every(
    (p) =>
      typeof p.scope === "string" &&
      typeof p.format === "string" &&
      Array.isArray(p.roster)
  );
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
    // Corrupt data — fall through and reseed.
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
  }
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
