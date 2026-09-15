/**
 * CLIENT-SIDE VIDEO CUTTING (Phase 3)
 * ─────────────────────────────────────────────────────────────────
 * Turns a project's one uploaded source video (Cloudflare R2, via
 * lib/portal/store.ts) into real separate files, one per period, using
 * ffmpeg.wasm running in the annotator's own browser — no server, no
 * ongoing cost, consistent with the $0 budget this whole backend
 * migration has been built under.
 *
 * ffmpeg.wasm itself (~30MB of WASM) is only fetched when cutting
 * actually starts (dynamic import + CDN-hosted core assets via
 * @ffmpeg/util's toBlobURL, the pattern documented by the ffmpeg.wasm
 * project itself) — it never loads on a normal workspace visit. Cut
 * clips upload to R2 via app/api/videos/clip-upload-url's presigned
 * URLs, same authorization model as the original upload.
 *
 * Cutting one segment at a time and uploading/recording each
 * independently means a single failure doesn't block the rest — a
 * segment with no clip_path just keeps falling back to seeking within
 * the full source video (see AnnotationWorkspace.tsx).
 */

import { getProjectVideoUrl, type Project } from "./store";
import { setSegmentClipPath, type VideoSegment } from "./segments";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

// @ffmpeg/ffmpeg's worker only auto-switches umd->esm for ITS OWN default
// core URL — since we always pass a custom (blob) URL, that fallback
// never kicks in, so this has to point at the esm build ourselves: the
// worker runs as a module worker and loads the core via `import()`,
// which can't parse the umd build's non-ESM syntax.
const FFMPEG_CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

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
  | { ok: true; cutCount: number; failedLabels: string[]; firstFailureDetail?: string }
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
    // ffmpeg's own internal messages (including the actual reason a cut
    // fails, e.g. a bad argument or an unreadable input) only ever surface
    // through this log event — exec() resolving/rejecting doesn't carry
    // that detail on its own.
    ffmpeg.on("log", ({ message }) => console.log("[ffmpeg]", message));

    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      // @ffmpeg/ffmpeg's own load() resolves its internal worker as
      // `new URL(classWorkerURL, import.meta.url)` — and in this
      // Turbopack dev setup, import.meta.url for this dynamically
      // imported package resolves to a file:// URL, not a proper
      // http(s) one. `new URL()` only falls back to a base when the
      // first argument has no scheme of its own, so a path like
      // "/ffmpeg/worker.js" inherits that broken file:// scheme —
      // producing "Script ... cannot be accessed from origin ...".
      // Passing a FULLY QUALIFIED URL (own scheme + host) sidesteps
      // this entirely: it's used as-is regardless of the base.
      classWorkerURL: `${window.location.origin}/ffmpeg/worker.js`,
    });

    const sourceUrl = await getProjectVideoUrl(project);
    const sourceBytes = await fetchFile(sourceUrl);
    await ffmpeg.writeFile(inputName, sourceBytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("cutProjectIntoClips setup failed:", err);
    return { ok: false, error: `Couldn't start video cutting: ${message}` };
  }

  const mimeType = mimeForExtension(ext);
  const failedLabels: string[] = [];
  let firstFailureDetail: string | null = null;
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
      const blob = new Blob([data as BlobPart], { type: mimeType });

      const urlRes = await fetch("/api/videos/clip-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, label: seg.label, ext, contentType: mimeType }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) {
        console.error(`Cutting ${seg.label} failed to get an upload URL:`, urlData.error);
        failedLabels.push(seg.label);
        firstFailureDetail ??= urlData.error ?? "Couldn't get an upload URL.";
        continue;
      }

      const putRes = await fetch(urlData.url, { method: "PUT", headers: { "Content-Type": mimeType }, body: blob });
      if (!putRes.ok) {
        console.error(`Cutting ${seg.label} failed to upload (status ${putRes.status})`);
        failedLabels.push(seg.label);
        firstFailureDetail ??= `Upload failed (status ${putRes.status}).`;
        continue;
      }

      await setSegmentClipPath(project.id, seg.label, urlData.key);
      await ffmpeg.deleteFile(outputName);
      cutCount++;
    } catch (err) {
      console.error(`Cutting ${seg.label} failed:`, err);
      failedLabels.push(seg.label);
      firstFailureDetail ??= err instanceof Error ? err.message : String(err);
    }
  }

  onProgress?.({ label: "", index: segments.length, total: segments.length });
  return { ok: true, cutCount, failedLabels, firstFailureDetail: firstFailureDetail ?? undefined };
}
