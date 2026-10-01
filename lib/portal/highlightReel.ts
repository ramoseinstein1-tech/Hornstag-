/**
 * HIGHLIGHT REEL GENERATION
 * ─────────────────────────────────────────────────────────────────
 * Stitches every "made shot + assist" tagged event that has a real clip
 * (lib/portal/results.ts's computeClips) into one downloadable video,
 * entirely client-side via ffmpeg.wasm — same $0 approach as period
 * cutting in lib/portal/videoClips.ts, just working from the already-cut
 * period clips instead of the original source (which may no longer
 * exist once every period is cut — see Project.videoCleared).
 *
 * Each qualifying event gets a short window cut from its period's clip
 * (a few seconds before/after the tagged timestamp), then every window
 * is concatenated in chronological order via ffmpeg's concat demuxer —
 * safe here because every window is stream-copied from the same source
 * video, so codec/resolution/timebase all match.
 */

import { getSegmentClipUrl } from "./segments";
import { setHighlightReelPath } from "./store";
import type { Project, TaggedClip } from "./store";
import { extensionOf, mimeForExtension } from "./videoClips";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

const FFMPEG_CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
const SECONDS_BEFORE = 3;
const SECONDS_AFTER = 4;

export type HighlightProgress = { index: number; total: number };
export type HighlightResult = { ok: true; key: string; clipCount: number } | { ok: false; error: string };

/** Which tagged clips qualify for the default "made shots + assists"
 * reel — a real clip with a known offset is required, since there's
 * nothing to cut otherwise. */
export function selectHighlightClips(clips: TaggedClip[]): TaggedClip[] {
  return clips.filter(
    (c) =>
      c.clipPath != null &&
      c.clipOffsetSeconds != null &&
      (c.eventType === "assist" ||
        ((c.eventType === "two_point" || c.eventType === "three_point" || c.eventType === "free_throw") && c.made === true))
  );
}

// Sanitized to a flat ffmpeg.wasm virtual-FS filename — clipPath is an
// R2 key like "games/{id}/segments/Q1.mp4", which contains slashes
// ffmpeg.wasm's FS would otherwise treat as directories.
function periodFileName(clipPath: string): string {
  return `period_${clipPath.replace(/[^a-zA-Z0-9_.]/g, "_")}`;
}

export async function generateHighlightReel(
  project: Project,
  clips: TaggedClip[],
  onProgress?: (p: HighlightProgress) => void
): Promise<HighlightResult> {
  const selected = selectHighlightClips(clips);
  if (selected.length === 0) {
    return { ok: false, error: "No made shots or assists with a real clip to build a reel from yet." };
  }

  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL, fetchFile } = await import("@ffmpeg/util");

    const ffmpeg: FFmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => console.log("[ffmpeg]", message));

    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      classWorkerURL: `${window.location.origin}/ffmpeg/worker.js`,
    });

    // Fetch each distinct period clip exactly once, even when several
    // selected events share it.
    const distinctClipPaths = Array.from(new Set(selected.map((c) => c.clipPath!)));
    const ext = extensionOf(distinctClipPaths[0]);
    const mimeType = mimeForExtension(ext);

    for (const clipPath of distinctClipPaths) {
      const url = await getSegmentClipUrl(project.id, clipPath);
      if (!url) return { ok: false, error: "Couldn't load one of the period clips this reel needs." };
      const bytes = await fetchFile(url);
      await ffmpeg.writeFile(periodFileName(clipPath), bytes);
    }

    const segmentNames: string[] = [];
    for (let i = 0; i < selected.length; i++) {
      const clip = selected[i];
      onProgress?.({ index: i, total: selected.length });

      const start = Math.max(0, clip.clipOffsetSeconds! - SECONDS_BEFORE);
      const duration = SECONDS_BEFORE + SECONDS_AFTER;
      const outName = `hl_${i}.${ext}`;

      // Same fast, keyframe-based -ss-before-i + -c copy technique as
      // period cutting — acceptable slack for a highlight window, same
      // as it is for period boundaries.
      await ffmpeg.exec(["-ss", String(start), "-i", periodFileName(clip.clipPath!), "-t", String(duration), "-c", "copy", outName]);
      segmentNames.push(outName);
    }

    const listContent = segmentNames.map((n) => `file '${n}'`).join("\n");
    await ffmpeg.writeFile("list.txt", new TextEncoder().encode(listContent));
    await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", `reel.${ext}`]);

    const reelData = await ffmpeg.readFile(`reel.${ext}`);
    if (!reelData || reelData.length === 0) {
      return { ok: false, error: "ffmpeg produced an empty highlight reel." };
    }
    const blob = new Blob([reelData as BlobPart], { type: mimeType });

    const urlRes = await fetch("/api/videos/highlight-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, ext, contentType: mimeType }),
    });
    const urlData = await urlRes.json();
    if (!urlRes.ok) return { ok: false, error: urlData.error ?? "Couldn't get an upload URL for the reel." };

    const putRes = await fetch(urlData.url, { method: "PUT", headers: { "Content-Type": mimeType }, body: blob });
    if (!putRes.ok) return { ok: false, error: `Reel upload failed (status ${putRes.status}).` };

    await setHighlightReelPath(project.id, urlData.key);
    onProgress?.({ index: selected.length, total: selected.length });
    return { ok: true, key: urlData.key, clipCount: selected.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("generateHighlightReel failed:", err);
    return { ok: false, error: `Couldn't generate the highlight reel: ${message}` };
  }
}
