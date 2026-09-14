/**
 * CLIENT-SIDE VIDEO CUTTING (Phase 3)
 * ─────────────────────────────────────────────────────────────────
 * Turns a project's one uploaded source video (lib/portal/store.ts,
 * Phase 2) into real separate files, one per period, using ffmpeg.wasm
 * running in the annotator's own browser — no server, no ongoing cost,
 * consistent with the $0 budget this whole backend migration has been
 * built under.
 *
 * ffmpeg.wasm itself (~30MB of WASM) is only fetched when cutting
 * actually starts (dynamic import + CDN-hosted core assets via
 * @ffmpeg/util's toBlobURL, the pattern documented by the ffmpeg.wasm
 * project itself) — it never loads on a normal workspace visit.
 *
 * Cutting one segment at a time and uploading/recording each
 * independently means a single failure doesn't block the rest — a
 * segment with no clip_path just keeps falling back to seeking within
 * the full source video (see AnnotationWorkspace.tsx).
 */

import { createClient } from "@/lib/supabase/client";
import { VIDEO_BUCKET, getProjectVideoUrl, type Project } from "./store";
import { setSegmentClipPath, type VideoSegment } from "./segments";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

const FFMPEG_CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

function extensionOf(path: string): string {
  return path.includes(".") ? path.split(".").pop()!.toLowerCase() : "mp4";
}

function mimeForExtension(ext: string): string {
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  return "video/mp4";
}

export type ClipProgress = { label: string; index: number; total: number };
export type CutResult =
  | { ok: true; cutCount: number; failedLabels: string[] }
  | { ok: false; error: string };

/**
 * Cuts every segment of `project` into its own video file. No-ops
 * entirely if the project has no real uploaded video (project.videoPath
 * unset) — there's nothing real to cut for the shared sample-clip
 * fallback. Setup failures (ffmpeg.wasm failing to load, the source
 * video failing to fetch) abort the whole run and are reported via the
 * returned result; per-segment failures after that don't abort the
 * rest — a segment with no clip_path just keeps falling back to
 * seeking within the full source video (see AnnotationWorkspace.tsx).
 */
export async function cutProjectIntoClips(
  project: Project,
  segments: VideoSegment[],
  onProgress?: (progress: ClipProgress) => void
): Promise<CutResult> {
  if (!project.videoPath || segments.length === 0) {
    return { ok: false, error: "No uploaded video to cut." };
  }

  let ffmpeg: FFmpeg;
  const ext = extensionOf(project.videoPath);
  const inputName = `input.${ext}`;

  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL, fetchFile } = await import("@ffmpeg/util");

    ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });

    const sourceUrl = await getProjectVideoUrl(project);
    const sourceBytes = await fetchFile(sourceUrl);
    await ffmpeg.writeFile(inputName, sourceBytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("cutProjectIntoClips setup failed:", err);
    return { ok: false, error: `Couldn't start video cutting: ${message}` };
  }

  const supabase = createClient();
  const mimeType = mimeForExtension(ext);
  const failedLabels: string[] = [];
  let cutCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    onProgress?.({ label: seg.label, index: i, total: segments.length });

    try {
      const outputName = `${seg.label}.${ext}`;
      const duration = seg.endSeconds - seg.startSeconds;

      // -ss before -i is a fast, keyframe-based seek — much quicker than
      // a precise seek, at the cost of the cut possibly landing up to
      // one GOP early/late. Combined with -c copy (no re-encode), this
      // keeps cutting fast enough to run in-browser; acceptable slack
      // for period boundaries, not a concern for annotation accuracy.
      await ffmpeg.exec([
        "-ss", String(seg.startSeconds),
        "-i", inputName,
        "-t", String(duration),
        "-c", "copy",
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      if (!data || data.length === 0) {
        throw new Error("ffmpeg produced an empty file for this segment");
      }
      const clipPath = `${project.id}/clips/${seg.label}.${ext}`;
      const blob = new Blob([data as BlobPart], { type: mimeType });

      const { error: uploadError } = await supabase.storage.from(VIDEO_BUCKET).upload(clipPath, blob, {
        upsert: true,
        contentType: mimeType,
      });
      if (uploadError) {
        console.error(`Cutting ${seg.label} failed to upload:`, uploadError);
        failedLabels.push(seg.label);
        continue;
      }

      await setSegmentClipPath(project.id, seg.label, clipPath);
      await ffmpeg.deleteFile(outputName);
      cutCount++;
    } catch (err) {
      console.error(`Cutting ${seg.label} failed:`, err);
      failedLabels.push(seg.label);
    }
  }

  onProgress?.({ label: "", index: segments.length, total: segments.length });
  return { ok: true, cutCount, failedLabels };
}
