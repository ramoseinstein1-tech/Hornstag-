/**
 * MOCK, BROWSER-GLOBAL PROJECT INDEX
 * ─────────────────────────────────────────────────────────────────
 * There is no real backend, so `Project` records live in each client's OWN
 * localStorage bucket (hornstag_portal_v3_${userId}, see ./store) and are
 * invisible to other accounts by construction. For an Annotator role to
 * see anything to claim, this module keeps a lightweight, ORIGIN-WIDE (not
 * per-user) pointer index in a single shared key.
 *
 * This only works because localStorage is scoped to the browser/origin,
 * not to whoever is "logged in" — so it ONLY surfaces projects created in
 * the SAME BROWSER as the annotator account. A client who uploads from a
 * different machine/browser will never be visible to an annotator signed
 * in elsewhere. This is a demo-only limitation; a real backend would
 * replace this whole file with a projects API scoped by role/permissions.
 *
 * Deliberately kept THIN (a pointer table, not a cache): display fields
 * like name/roster/status are NOT duplicated here. Callers resolve the
 * full Project via getProjects(entry.ownerId) from ./store — the same
 * localStorage is readable from any role in this browser, so this is a
 * safe, single-source-of-truth lookup, not a security boundary.
 */

export type GlobalAnnotationStatus = "Unclaimed" | "Claimed" | "In Review" | "Completed";

export type GlobalProjectEntry = {
  projectId: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  claimedBy?: { annotatorId: string; annotatorName: string; claimedAt: string };
  annotationStatus: GlobalAnnotationStatus;
};

const GLOBAL_KEY = "hornstag_global_projects_v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function isValidShape(data: unknown): data is GlobalProjectEntry[] {
  return (
    Array.isArray(data) &&
    data.every(
      (e) =>
        e &&
        typeof e === "object" &&
        typeof e.projectId === "string" &&
        typeof e.ownerId === "string" &&
        typeof e.annotationStatus === "string"
    )
  );
}

function readIndex(): GlobalProjectEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(GLOBAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidShape(parsed)) return parsed;
    }
  } catch {
    // Corrupt data — treat as empty.
  }
  return [];
}

function writeIndex(entries: GlobalProjectEntry[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(GLOBAL_KEY, JSON.stringify(entries));
}

export function publishProjectToGlobalIndex(entry: {
  projectId: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}): void {
  const entries = readIndex();
  if (entries.some((e) => e.projectId === entry.projectId)) return;
  writeIndex([
    ...entries,
    { ...entry, annotationStatus: "Unclaimed" },
  ]);
}

export function getGlobalProjects(): GlobalProjectEntry[] {
  return readIndex();
}

export function getGlobalProjectByProjectId(projectId: string): GlobalProjectEntry | undefined {
  return readIndex().find((e) => e.projectId === projectId);
}

export function claimProject(
  projectId: string,
  annotator: { id: string; name: string }
): { ok: true; entry: GlobalProjectEntry } | { ok: false; error: string } {
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.projectId === projectId);
  if (idx === -1) return { ok: false, error: "This match is no longer available." };

  const existing = entries[idx];
  if (existing.claimedBy && existing.claimedBy.annotatorId !== annotator.id) {
    return { ok: false, error: "This match has already been claimed by another annotator." };
  }

  const updated: GlobalProjectEntry = {
    ...existing,
    claimedBy: { annotatorId: annotator.id, annotatorName: annotator.name, claimedAt: new Date().toISOString() },
    annotationStatus: "Claimed",
  };
  entries[idx] = updated;
  writeIndex(entries);
  return { ok: true, entry: updated };
}

export function unclaimProject(projectId: string): void {
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.projectId === projectId);
  if (idx === -1) return;
  entries[idx] = { ...entries[idx], claimedBy: undefined, annotationStatus: "Unclaimed" };
  writeIndex(entries);
}

export function setAnnotationStatus(projectId: string, status: GlobalAnnotationStatus): void {
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.projectId === projectId);
  if (idx === -1) return;
  entries[idx] = { ...entries[idx], annotationStatus: status };
  writeIndex(entries);
}

/** Called from the annotator account-deletion flow so a deleted annotator
 * doesn't leave a permanently "claimed by [ghost]" row behind. */
export function releaseAnnotatorClaims(annotatorId: string): void {
  const entries = readIndex();
  writeIndex(
    entries.map((e) =>
      e.claimedBy?.annotatorId === annotatorId
        ? { ...e, claimedBy: undefined, annotationStatus: "Unclaimed" as const }
        : e
    )
  );
}
