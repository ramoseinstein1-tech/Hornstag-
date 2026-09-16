/**
 * REAL, SUPABASE-BACKED VIDEO SEGMENTATION STORE
 * ─────────────────────────────────────────────────────────────────
 * Before tagging events, the annotator must mark the game video's period
 * boundaries (quarters or halves, per the client's chosen GameFormat) so
 * events can be attributed to the right period later. The boundaries are
 * persisted in the `video_segments` table (see
 * supabase/migrations/00000000000000_init.sql), shared between the
 * client and annotator via RLS.
 *
 * Phase 3 (supabase/migrations/00000000000009_video_clips.sql) adds real
 * per-period video files, cut client-side from the Phase 2 upload — see
 * lib/portal/videoClips.ts for the cutting pipeline. `clipPath` here is
 * that clip's path once it exists; undefined means either the video
 * hasn't been cut yet (still processing, or cutting failed for that
 * segment) or there's no real source video to cut in the first place.
 */

import { createClient } from "@/lib/supabase/client";

export type VideoSegment = {
  label: string;
  startSeconds: number;
  endSeconds: number;
  clipPath?: string;
  /** Phase 5 game clock — see computeGameClockSeconds below. Undefined
   * means this period's clock hasn't been started yet. */
  clockReferenceVideoSeconds?: number;
  clockReferenceValueSeconds?: number;
  clockRunning: boolean;
};

type SegmentRow = {
  label: string;
  start_seconds: number;
  end_seconds: number;
  sort_order: number;
  clip_path: string | null;
  clock_reference_video_seconds: number | null;
  clock_reference_value_seconds: number | null;
  clock_running: boolean;
};

/** Null means the video hasn't been segmented yet — the annotate tab
 * stays locked until this returns a real array. */
export async function getSegments(projectId: string): Promise<VideoSegment[] | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("video_segments")
    .select("label, start_seconds, end_seconds, sort_order, clip_path, clock_reference_video_seconds, clock_reference_value_seconds, clock_running")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return null;
  return (data as SegmentRow[]).map((r) => ({
    label: r.label,
    startSeconds: r.start_seconds,
    endSeconds: r.end_seconds,
    clipPath: r.clip_path ?? undefined,
    clockReferenceVideoSeconds: r.clock_reference_video_seconds ?? undefined,
    clockReferenceValueSeconds: r.clock_reference_value_seconds ?? undefined,
    clockRunning: r.clock_running,
  }));
}

/** Replaces the project's segments wholesale — callers always pass the
 * complete boundary list, so delete-then-insert matches existing
 * "whole array replacement" semantics rather than diffing. Any existing
 * clip_path values are intentionally dropped: re-saving segment
 * boundaries means the old clips (cut to the old boundaries) are stale,
 * and lib/portal/videoClips.ts re-cuts fresh ones after this call. */
export async function saveSegments(projectId: string, segments: VideoSegment[]): Promise<void> {
  const supabase = createClient();
  await supabase.from("video_segments").delete().eq("project_id", projectId);
  if (segments.length > 0) {
    await supabase.from("video_segments").insert(
      segments.map((s, i) => ({
        project_id: projectId,
        label: s.label,
        start_seconds: s.startSeconds,
        end_seconds: s.endSeconds,
        sort_order: i,
      }))
    );
  }
}

/** Records a cut clip's storage path against its segment row, once
 * lib/portal/videoClips.ts finishes cutting it. */
export async function setSegmentClipPath(projectId: string, label: string, clipPath: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("video_segments").update({ clip_path: clipPath }).eq("project_id", projectId).eq("label", label);
}

/**
 * GAME CLOCK (Phase 5)
 * ─────────────────────────────────────────────────────────────────
 * A real basketball clock, distinct from the video's own timestamp —
 * it ticks down in lockstep with video playback once started, pauses
 * when the annotator pauses it (fouls, timeouts, stoppages), and
 * because it's purely a function of video position rather than
 * wall-clock time, rewinding the video while it's running naturally
 * moves it back up too, with no special-case logic needed.
 */

/** The clock's value at a given video position — null if this period's
 * clock hasn't been started yet. Not clamped at zero: an annotator who
 * started the clock a little early sees an honest (if odd-looking)
 * negative reading rather than a silently wrong one. */
export function computeGameClockSeconds(segment: VideoSegment, videoTimeSeconds: number): number | null {
  if (segment.clockReferenceVideoSeconds == null || segment.clockReferenceValueSeconds == null) return null;
  if (segment.clockRunning) {
    return segment.clockReferenceValueSeconds - (videoTimeSeconds - segment.clockReferenceVideoSeconds);
  }
  return segment.clockReferenceValueSeconds;
}

/** Plain M:SS — not H:MM:SS, since a basketball period is always well
 * under an hour. Handles negative values (see computeGameClockSeconds). */
export function formatClockMMSS(seconds: number): string {
  const negative = seconds < 0;
  const abs = Math.round(Math.abs(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${negative ? "-" : ""}${m}:${String(s).padStart(2, "0")}`;
}

/** Inverse of formatClockMMSS — "M:SS" or "MM:SS" only, no hours (a
 * basketball period is never long enough to need one). Returns null for
 * anything that doesn't parse cleanly, including a blank string. */
export function parseClockMMSS(input: string): number | null {
  const parts = input.trim().split(":").map((p) => p.trim());
  if (parts.length !== 2 || parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const [m, s] = parts.map(Number);
  if (s >= 60) return null;
  return m * 60 + s;
}

/** Starts a period's clock: the annotator has typed the period's
 * starting time (e.g. 600 for "10:00") and clicked START at the jump
 * ball, at the given video position. */
export async function startPeriodClock(
  projectId: string,
  label: string,
  startValueSeconds: number,
  atVideoSeconds: number
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("video_segments")
    .update({
      clock_reference_video_seconds: atVideoSeconds,
      clock_reference_value_seconds: startValueSeconds,
      clock_running: true,
    })
    .eq("project_id", projectId)
    .eq("label", label);
}

/** Pauses a running clock. `frozenValueSeconds` should already be
 * computed (via computeGameClockSeconds) at the moment of pausing —
 * this just bakes that frozen value in rather than re-deriving it. */
export async function pausePeriodClock(projectId: string, label: string, frozenValueSeconds: number): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("video_segments")
    .update({ clock_reference_value_seconds: frozenValueSeconds, clock_running: false })
    .eq("project_id", projectId)
    .eq("label", label);
}

/** Resumes a paused clock from the current video position. */
export async function resumePeriodClock(projectId: string, label: string, atVideoSeconds: number): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("video_segments")
    .update({ clock_reference_video_seconds: atVideoSeconds, clock_running: true })
    .eq("project_id", projectId)
    .eq("label", label);
}

/** A playable signed URL for a cut clip, or null if it can't be
 * resolved (expired path, access denied, etc.) — callers fall back to
 * the full source video in that case. */
export async function getSegmentClipUrl(projectId: string, clipPath: string): Promise<string | null> {
  const res = await fetch("/api/videos/playback-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, key: clipPath }),
  });
  if (!res.ok) return null;
  const { url } = await res.json();
  return url ?? null;
}

export async function deleteProjectSegments(projectId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("video_segments").delete().eq("project_id", projectId);
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
