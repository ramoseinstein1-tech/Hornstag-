import { describe, expect, it } from "vitest";
import { computeGameClockSeconds, formatClockMMSS, parseClockMMSS, periodForTimestamp, type VideoSegment } from "./segments";

describe("computeGameClockSeconds", () => {
  it("returns null when the clock was never started", () => {
    const seg: VideoSegment = { label: "Q1", startSeconds: 0, endSeconds: 600, clockRunning: false };
    expect(computeGameClockSeconds(seg, 30)).toBeNull();
  });

  it("returns the frozen value while paused, regardless of video position", () => {
    const seg: VideoSegment = {
      label: "Q1",
      startSeconds: 0,
      endSeconds: 600,
      clockRunning: false,
      clockReferenceVideoSeconds: 50,
      clockReferenceValueSeconds: 480,
    };
    expect(computeGameClockSeconds(seg, 999)).toBe(480);
  });

  it("counts down 1:1 with video time while running", () => {
    const seg: VideoSegment = {
      label: "Q1",
      startSeconds: 0,
      endSeconds: 600,
      clockRunning: true,
      clockReferenceVideoSeconds: 10,
      clockReferenceValueSeconds: 600,
    };
    expect(computeGameClockSeconds(seg, 40)).toBe(570); // 30s of video elapsed -> 30s off the clock
  });

  it("rises again if the video is rewound while running (not clamped)", () => {
    const seg: VideoSegment = {
      label: "Q1",
      startSeconds: 0,
      endSeconds: 600,
      clockRunning: true,
      clockReferenceVideoSeconds: 40,
      clockReferenceValueSeconds: 500,
    };
    expect(computeGameClockSeconds(seg, 30)).toBe(510); // rewound 10s -> clock goes back up 10s
  });
});

describe("formatClockMMSS / parseClockMMSS", () => {
  it("round-trips whole minute/second values", () => {
    expect(formatClockMMSS(605)).toBe("10:05");
    expect(parseClockMMSS("10:05")).toBe(605);
  });

  it("formats a negative clock value with a leading minus", () => {
    expect(formatClockMMSS(-5)).toBe("-0:05");
  });

  it("rejects malformed input", () => {
    expect(parseClockMMSS("garbage")).toBeNull();
    expect(parseClockMMSS("1:2:3")).toBeNull();
    expect(parseClockMMSS("1:75")).toBeNull(); // seconds >= 60
    expect(parseClockMMSS("")).toBeNull();
  });
});

describe("periodForTimestamp", () => {
  const segments: VideoSegment[] = [
    { label: "Q1", startSeconds: 0, endSeconds: 600, clockRunning: false },
    { label: "Q2", startSeconds: 600, endSeconds: 1200, clockRunning: false },
  ];

  it("finds the segment containing a timestamp", () => {
    expect(periodForTimestamp(segments, 300)).toBe("Q1");
    expect(periodForTimestamp(segments, 600)).toBe("Q2"); // boundary belongs to the next period
  });

  it("falls back to the last segment past its start (end-of-video edge case)", () => {
    expect(periodForTimestamp(segments, 5000)).toBe("Q2");
  });

  it("returns undefined before the first segment starts", () => {
    expect(periodForTimestamp(segments, -1)).toBeUndefined();
  });
});
