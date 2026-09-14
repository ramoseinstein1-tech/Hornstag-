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
import { VIDEO_BUCKET } from "./store";

export type VideoSegment = {
  label: string;
  startSeconds: number;
  endSeconds: number;
  clipPath?: string;
};

type SegmentRow = {
  label: string;
  start_seconds: number;
  end_seconds: number;
  sort_order: number;
  clip_path: string | null;
};

/** Null means the video hasn't been segmented yet — the annotate tab
 * stays locked until this returns a real array. */
export async function getSegments(projectId: string): Promise<VideoSegment[] | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("video_segments")
    .select("label, start_seconds, end_seconds, sort_order, clip_path")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return null;
  return (data as SegmentRow[]).map((r) => ({
    label: r.label,
    startSeconds: r.start_seconds,
    endSeconds: r.end_seconds,
    clipPath: r.clip_path ?? undefined,
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

/** A playable signed URL for a cut clip, or null if it can't be
 * resolved (expired path, RLS denial, etc.) — callers fall back to the
 * full source video in that case. */
export async function getSegmentClipUrl(clipPath: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(clipPath, 3600);
  if (error || !data) return null;
  return data.signedUrl;
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
