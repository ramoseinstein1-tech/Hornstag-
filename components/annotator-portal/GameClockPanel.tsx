"use client";

import { useState } from "react";
import { computeGameClockSeconds, formatClockMMSS, parseClockMMSS, type VideoSegment } from "@/lib/portal/segments";

/**
 * A real basketball game clock, distinct from the video's own
 * timestamp — see lib/portal/segments.ts's computeGameClockSeconds for
 * the mechanics. Shown persistently in the ANNOTATE tab (not buried in
 * the event form) since the annotator toggles pause/play in real time
 * while watching, independent of whether they're mid-way through
 * tagging a specific event.
 */
export default function GameClockPanel({
  segment,
  currentTimeSeconds,
  onStart,
  onPause,
  onResume,
}: {
  segment: VideoSegment;
  currentTimeSeconds: number;
  onStart: (startValueSeconds: number) => void;
  onPause: (frozenValueSeconds: number) => void;
  onResume: () => void;
}) {
  const [startInput, setStartInput] = useState("10:00");
  const started = segment.clockReferenceVideoSeconds != null;
  const liveValue = computeGameClockSeconds(segment, currentTimeSeconds);
  const parsedStart = parseClockMMSS(startInput);

  return (
    <div className="hs-panel flex flex-wrap items-center gap-3 p-4">
      <span className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">GAME CLOCK</span>

      {!started ? (
        <>
          <input
            className="hs-input !w-24 text-center"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            placeholder="10:00"
            aria-label="Period starting time"
          />
          <button
            type="button"
            onClick={() => parsedStart != null && onStart(parsedStart)}
            disabled={parsedStart == null}
            className="hs-btn-primary !px-3 !py-1.5 !text-[0.62rem] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▶ START AT JUMP BALL
          </button>
          <span className="font-mono-tech text-[0.58rem] text-text-faint">
            Enter this period&rsquo;s length, then click Start the instant play begins.
          </span>
        </>
      ) : (
        <>
          <span className="font-display text-2xl font-semibold tabular-nums text-orange-bright">
            {formatClockMMSS(liveValue ?? 0)}
          </span>
          {segment.clockRunning ? (
            <button
              type="button"
              onClick={() => onPause(liveValue ?? 0)}
              className="hs-btn-secondary !px-3 !py-1.5 !text-[0.62rem]"
            >
              ❚❚ PAUSE
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              className="hs-btn-primary !px-3 !py-1.5 !text-[0.62rem]"
            >
              ▶ PLAY
            </button>
          )}
          <span className="font-mono-tech text-[0.58rem] text-text-faint">
            {segment.clockRunning
              ? "Running — pause on every whistle, timeout, or stoppage."
              : "Paused — press Play the instant the ball is live again."}
          </span>
        </>
      )}
    </div>
  );
}
