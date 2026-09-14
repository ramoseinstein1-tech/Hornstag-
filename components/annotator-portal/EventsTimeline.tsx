"use client";

import type { AnnotationEvent } from "@/lib/portal/events";
import { SHOT_EVENT_TYPES } from "@/lib/portal/events";

function tickColor(evt: AnnotationEvent): string {
  if (!SHOT_EVENT_TYPES.includes(evt.eventType)) return "var(--text-faint)";
  return evt.made ? "var(--orange)" : "rgba(245,242,234,0.35)";
}

export default function EventsTimeline({
  durationSeconds,
  events,
  onSeek,
}: {
  durationSeconds: number;
  events: AnnotationEvent[];
  onSeek: (seconds: number) => void;
}) {
  return (
    <div className="hs-panel p-4">
      <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">
        EVENT TIMELINE
      </p>
      <div className="relative h-8 rounded-md border border-border bg-surface">
        {durationSeconds > 0 &&
          events.map((evt) => (
            <button
              key={evt.id}
              type="button"
              onClick={() => onSeek(evt.timestampSeconds)}
              title={`${evt.eventType} @ ${evt.timestampSeconds.toFixed(1)}s`}
              className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125"
              style={{
                left: `${Math.min(100, Math.max(0, (evt.timestampSeconds / durationSeconds) * 100))}%`,
                background: tickColor(evt),
              }}
              aria-label={`Seek to ${evt.eventType} event`}
            />
          ))}
      </div>
    </div>
  );
}
