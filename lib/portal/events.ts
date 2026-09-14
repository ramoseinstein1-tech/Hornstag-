/**
 * MOCK, PER-PROJECT ANNOTATION EVENT STORE
 * ─────────────────────────────────────────────────────────────────
 * Same story as the other lib/portal stores — no backend, so this
 * persists in localStorage. Deliberately keyed PER-PROJECT
 * (hornstag_events_v1_${projectId}), NOT per-user like ./store.ts,
 * because these events belong to the match itself and must eventually be
 * readable by the CLIENT who owns the project (a different user id) when
 * they view Results — not just by whichever annotator tagged them. This
 * relies on the same origin-wide-localStorage mechanism (and same
 * same-browser-only caveat) as lib/portal/globalProjects.ts.
 */

export type EventType =
  | "two_point"
  | "three_point"
  | "free_throw"
  | "assist"
  | "steal"
  | "block"
  | "turnover"
  | "foul"
  | "technical_foul"
  | "offensive_rebound"
  | "defensive_rebound"
  | "custom";

export const SHOT_EVENT_TYPES: readonly EventType[] = ["two_point", "three_point", "free_throw"];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  two_point: "Two Point",
  three_point: "Three Point",
  free_throw: "Free Throw",
  assist: "Assist",
  steal: "Steal",
  block: "Block",
  turnover: "Turnover",
  foul: "Foul",
  technical_foul: "Technical Foul",
  offensive_rebound: "Offensive Rebound",
  defensive_rebound: "Defensive Rebound",
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
  teamSide: TeamSide;
  playerId: string;
  eventType: EventType;
  /** Only meaningful when eventType is a shot type. */
  made?: boolean;
  /** Only present when eventType is a shot type. */
  shotLocation?: ShotLocation;
  /** Only used when eventType === "custom". */
  customLabel?: string;
  createdAt: string;
  updatedAt: string;
};

const KEY_PREFIX = "hornstag_events_v1_";

function isBrowser() {
  return typeof window !== "undefined";
}

function key(projectId: string) {
  return `${KEY_PREFIX}${projectId}`;
}

function isValidShape(data: unknown): data is AnnotationEvent[] {
  return (
    Array.isArray(data) &&
    data.every(
      (e) =>
        e &&
        typeof e === "object" &&
        typeof e.id === "string" &&
        typeof e.timestampSeconds === "number" &&
        typeof e.playerId === "string" &&
        typeof e.eventType === "string"
    )
  );
}

function readEvents(projectId: string): AnnotationEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(key(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidShape(parsed)) return parsed;
    }
  } catch {
    // Corrupt data — treat as empty.
  }
  return [];
}

function writeEvents(projectId: string, events: AnnotationEvent[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key(projectId), JSON.stringify(events));
}

export function getEvents(projectId: string): AnnotationEvent[] {
  return readEvents(projectId);
}

export function deleteProjectEvents(projectId: string): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key(projectId));
}

export type NewEventInput = Omit<AnnotationEvent, "id" | "projectId" | "createdAt" | "updatedAt">;

/** Two events are exact duplicates only if EVERY tagged field matches —
 * an assist and the made shot it led to at the same timestamp are never
 * blocked, since eventType (and usually playerId) differ. Only a
 * byte-for-byte re-submission (e.g. a double-click on Save) is rejected. */
function isExactDuplicate(a: NewEventInput, b: AnnotationEvent): boolean {
  return (
    a.timestampSeconds === b.timestampSeconds &&
    a.teamSide === b.teamSide &&
    a.playerId === b.playerId &&
    a.eventType === b.eventType &&
    (a.made ?? null) === (b.made ?? null) &&
    (a.shotLocation?.x ?? null) === (b.shotLocation?.x ?? null) &&
    (a.shotLocation?.y ?? null) === (b.shotLocation?.y ?? null) &&
    (a.customLabel ?? null) === (b.customLabel ?? null)
  );
}

export function createEvent(
  projectId: string,
  input: NewEventInput
): { ok: true; event: AnnotationEvent } | { ok: false; error: string } {
  const events = readEvents(projectId);
  if (events.some((e) => isExactDuplicate(input, e))) {
    return { ok: false, error: "An identical event already exists at this timestamp." };
  }

  const now = new Date().toISOString();
  const event: AnnotationEvent = {
    id: crypto.randomUUID(),
    projectId,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  writeEvents(projectId, [...events, event]);
  return { ok: true, event };
}

export function updateEvent(
  projectId: string,
  eventId: string,
  patch: Partial<NewEventInput>
): { ok: true; event: AnnotationEvent } | { ok: false; error: string } {
  const events = readEvents(projectId);
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx === -1) return { ok: false, error: "Event not found." };

  const candidate: NewEventInput = {
    timestampSeconds: patch.timestampSeconds ?? events[idx].timestampSeconds,
    teamSide: patch.teamSide ?? events[idx].teamSide,
    playerId: patch.playerId ?? events[idx].playerId,
    eventType: patch.eventType ?? events[idx].eventType,
    made: "made" in patch ? patch.made : events[idx].made,
    shotLocation: "shotLocation" in patch ? patch.shotLocation : events[idx].shotLocation,
    customLabel: "customLabel" in patch ? patch.customLabel : events[idx].customLabel,
  };

  if (events.some((e, i) => i !== idx && isExactDuplicate(candidate, e))) {
    return { ok: false, error: "An identical event already exists at this timestamp." };
  }

  const updated: AnnotationEvent = {
    ...events[idx],
    ...candidate,
    updatedAt: new Date().toISOString(),
  };
  events[idx] = updated;
  writeEvents(projectId, events);
  return { ok: true, event: updated };
}

export function deleteEvent(projectId: string, eventId: string): void {
  writeEvents(projectId, readEvents(projectId).filter((e) => e.id !== eventId));
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
    if (evt.teamSide !== teamSide) continue;
    const s = statsFor(evt.playerId);
    s.pts += pointsForEvent(evt);
    if (evt.eventType === "offensive_rebound" || evt.eventType === "defensive_rebound") s.reb += 1;
    if (evt.eventType === "assist") s.ast += 1;
    if (evt.eventType === "steal") s.stl += 1;
    if (evt.eventType === "block") s.blk += 1;
    if (evt.eventType === "turnover") s.tov += 1;
    if (evt.eventType === "foul" || evt.eventType === "technical_foul") s.pf += 1;
  }

  return Array.from(byPlayer.values());
}
