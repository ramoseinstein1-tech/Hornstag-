"use client";

import { useState } from "react";
import type { GameFormat } from "@/lib/portal/store";
import type { VideoSegment } from "@/lib/portal/segments";

const PERIODS: Record<GameFormat, string[]> = {
  Quarters: ["Q1", "Q2", "Q3", "Q4"],
  Halves: ["H1", "H2"],
};

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function SegmentVideo({
  format,
  duration,
  currentTimeSeconds,
  existing,
  onSave,
}: {
  format: GameFormat;
  duration: number;
  currentTimeSeconds: number;
  existing: VideoSegment[] | null;
  onSave: (segments: VideoSegment[]) => void;
}) {
  const periods = PERIODS[format];
  const boundaryCount = periods.length - 1;

  const [marks, setMarks] = useState<(number | null)[]>(() =>
    existing && existing.length === periods.length
      ? existing.slice(0, boundaryCount).map((s) => s.endSeconds)
      : Array(boundaryCount).fill(null)
  );

  function markBoundary(i: number) {
    const next = [...marks];
    next[i] = currentTimeSeconds;
    setMarks(next);
  }

  const allSet = duration > 0 && marks.every((m) => m !== null);
  const increasing =
    allSet &&
    marks.every((m, i) => (i === 0 ? m! > 0 : m! > marks[i - 1]!) && m! < duration);

  function handleSave() {
    if (!increasing) return;
    const boundaries = [0, ...(marks as number[]), duration];
    const segments: VideoSegment[] = periods.map((label, i) => ({
      label,
      startSeconds: boundaries[i],
      endSeconds: boundaries[i + 1],
    }));
    onSave(segments);
  }

  return (
    <div className="hs-panel sheen-top flex flex-col gap-5 p-5">
      <div>
        <p className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">SEGMENT VIDEO</p>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          This game is tracked by <span className="text-orange-bright">{format}</span>. Play or scrub
          the video to where each period ends, then mark it below — tagging stays locked until every
          segment is marked.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {periods.slice(0, -1).map((label, i) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="text-sm text-text">END OF {label}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono-tech text-[0.66rem] tracking-[0.04em] text-text-faint">
                {marks[i] !== null ? formatTime(marks[i]!) : "NOT SET"}
              </span>
              <button
                type="button"
                onClick={() => markBoundary(i)}
                className="hs-btn-secondary !px-3 !py-1.5 !text-[0.6rem]"
              >
                MARK AT CURRENT TIME
              </button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-surface/40 p-3">
          <span className="text-sm text-text-faint">END OF {periods[periods.length - 1]}</span>
          <span className="font-mono-tech text-[0.66rem] tracking-[0.04em] text-text-faint">
            {duration > 0 ? formatTime(duration) : "—"} (video end)
          </span>
        </div>
      </div>

      {allSet && !increasing && (
        <p className="font-mono-tech text-[0.62rem] tracking-wide text-[#ff9b9b]">
          Marks must increase from one period to the next and land before the end of the video.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!increasing}
        className="hs-btn-primary w-fit disabled:cursor-not-allowed disabled:opacity-40"
      >
        SAVE SEGMENTS &amp; START TAGGING
      </button>
    </div>
  );
}
