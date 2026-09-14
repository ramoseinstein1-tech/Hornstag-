"use client";

import type { AnnotationEvent } from "@/lib/portal/events";
import type { VideoSegment } from "@/lib/portal/segments";

export default function SegmentStepper({
  segments,
  activeIndex,
  events,
  onSelect,
}: {
  segments: VideoSegment[];
  activeIndex: number;
  events: AnnotationEvent[];
  onSelect: (index: number) => void;
}) {
  return (
    <div className="hs-panel flex flex-wrap items-center gap-2 p-3">
      <span className="mr-1 font-mono-tech text-[0.58rem] tracking-[0.16em] text-text-faint">SEGMENT</span>
      {segments.map((seg, i) => {
        const count = events.filter((e) => e.period === seg.label).length;
        const active = i === activeIndex;
        return (
          <button
            key={seg.label}
            type="button"
            onClick={() => onSelect(i)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-all duration-300 ${
              active
                ? "border-orange/50 bg-orange/10 text-orange-bright"
                : "border-border bg-transparent text-text-muted hover:border-border-strong"
            }`}
          >
            {seg.label}
            <span className="font-mono-tech text-[0.6rem] text-text-faint">{count}</span>
          </button>
        );
      })}
      <div className="ml-auto flex gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
          className="hs-btn-ghost !px-3 !py-1.5 !text-[0.62rem] disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← PREV
        </button>
        <button
          type="button"
          onClick={() => onSelect(Math.min(segments.length - 1, activeIndex + 1))}
          disabled={activeIndex === segments.length - 1}
          className="hs-btn-secondary !px-3 !py-1.5 !text-[0.62rem] disabled:cursor-not-allowed disabled:opacity-30"
        >
          NEXT SEGMENT →
        </button>
      </div>
    </div>
  );
}
