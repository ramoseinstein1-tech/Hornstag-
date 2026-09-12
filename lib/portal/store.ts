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

const KEY_PREFIX = "hornstag_portal_";

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

function readData(userId: string): PortalData {
  if (!isBrowser()) return { projects: [], activity: [] };
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (raw) return JSON.parse(raw) as PortalData;
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
