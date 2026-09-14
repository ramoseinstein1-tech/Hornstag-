/**
 * MOCK, PER-PROJECT VIDEO SEGMENTATION STORE
 * ─────────────────────────────────────────────────────────────────
 * Before tagging events, the annotator must cut the game video into its
 * periods (quarters or halves, per the client's chosen GameFormat) so
 * events can be attributed to the right period later. Since this demo
 * has no real per-project video (every workspace plays the same shared
 * sample clip, see VideoPlayer.tsx), "cutting" the video means marking
 * timestamp boundaries within that shared clip rather than splitting an
 * actual file — the boundaries are what's real and persisted here.
 *
 * Stored per-project (hornstag_segments_v1_${projectId}), matching
 * lib/portal/events.ts's per-project keying (not per-user), since these
 * boundaries describe the match itself.
 */

export type VideoSegment = {
  label: string;
  startSeconds: number;
  endSeconds: number;
};

const KEY_PREFIX = "hornstag_segments_v1_";

function isBrowser() {
  return typeof window !== "undefined";
}

function key(projectId: string) {
  return `${KEY_PREFIX}${projectId}`;
}

function isValidShape(data: unknown): data is VideoSegment[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (s) =>
        s &&
        typeof s === "object" &&
        typeof s.label === "string" &&
        typeof s.startSeconds === "number" &&
        typeof s.endSeconds === "number"
    )
  );
}

/** Null means the video hasn't been segmented yet — the annotate tab
 * stays locked until this returns a real array. */
export function getSegments(projectId: string): VideoSegment[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidShape(parsed)) return parsed;
    }
  } catch {
    // Corrupt data — treat as not-yet-segmented.
  }
  return null;
}

export function saveSegments(projectId: string, segments: VideoSegment[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key(projectId), JSON.stringify(segments));
}

export function deleteProjectSegments(projectId: string): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key(projectId));
}

/** Which period a timestamp falls in, derived from the real boundaries —
 * not from whichever segment button the annotator last clicked, so a tag
 * is always attributed correctly even if they scrub outside the segment
 * they're focused on. Falls back to the last segment for anything at or
 * past its start (covers the exact end-of-video edge case). */
export function periodForTimestamp(segments: VideoSegment[], timestampSeconds: number): string | undefined {
  for (const seg of segments) {
    if (timestampSeconds >= seg.startSeconds && timestampSeconds < seg.endSeconds) return seg.label;
  }
  const last = segments[segments.length - 1];
  return last && timestampSeconds >= last.startSeconds ? last.label : undefined;
}
