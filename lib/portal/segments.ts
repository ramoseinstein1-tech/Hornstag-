/**
 * REAL, SUPABASE-BACKED VIDEO SEGMENTATION STORE
 * ─────────────────────────────────────────────────────────────────
 * Before tagging events, the annotator must cut the game video into its
 * periods (quarters or halves, per the client's chosen GameFormat) so
 * events can be attributed to the right period later. Since there's no
 * real per-project video yet (Phase 2 of the backend migration — every
 * workspace still plays the same shared sample clip, see
 * VideoPlayer.tsx), "cutting" the video means marking timestamp
 * boundaries within that shared clip rather than splitting an actual
 * file — the boundaries are what's real and now persisted in the
 * `video_segments` table (see supabase/migrations/00000000000000_init.sql),
 * shared between the client and annotator via RLS instead of the old
 * origin-wide-localStorage trick.
 */

import { createClient } from "@/lib/supabase/client";

export type VideoSegment = {
  label: string;
  startSeconds: number;
  endSeconds: number;
};

type SegmentRow = {
  label: string;
  start_seconds: number;
  end_seconds: number;
  sort_order: number;
};

/** Null means the video hasn't been segmented yet — the annotate tab
 * stays locked until this returns a real array. */
export async function getSegments(projectId: string): Promise<VideoSegment[] | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("video_segments")
    .select("label, start_seconds, end_seconds, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return null;
  return (data as SegmentRow[]).map((r) => ({
    label: r.label,
    startSeconds: r.start_seconds,
    endSeconds: r.end_seconds,
  }));
}

/** Replaces the project's segments wholesale — callers always pass the
 * complete boundary list, so delete-then-insert matches existing
 * "whole array replacement" semantics rather than diffing. */
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
