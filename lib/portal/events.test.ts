import { describe, expect, it } from "vitest";
import {
  pointsForEvent,
  computeLiveStats,
  computePlayingTimeSeconds,
  computePlusMinus,
  type AnnotationEvent,
} from "./events";
import type { VideoSegment } from "./segments";

function evt(partial: Partial<AnnotationEvent> & Pick<AnnotationEvent, "timestampSeconds" | "eventType">): AnnotationEvent {
  return {
    id: Math.random().toString(36),
    projectId: "p1",
    teamSide: "team",
    playerId: "player-1",
    createdAt: "",
    updatedAt: "",
    ...partial,
  } as AnnotationEvent;
}

describe("pointsForEvent", () => {
  it("scores makes correctly per shot type, misses always zero", () => {
    expect(pointsForEvent(evt({ timestampSeconds: 0, eventType: "two_point", made: true }))).toBe(2);
    expect(pointsForEvent(evt({ timestampSeconds: 0, eventType: "three_point", made: true }))).toBe(3);
    expect(pointsForEvent(evt({ timestampSeconds: 0, eventType: "free_throw", made: true }))).toBe(1);
    expect(pointsForEvent(evt({ timestampSeconds: 0, eventType: "two_point", made: false }))).toBe(0);
    expect(pointsForEvent(evt({ timestampSeconds: 0, eventType: "assist" }))).toBe(0);
  });
});

describe("computeLiveStats", () => {
  it("aggregates per player and ignores the other team plus teamless events", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "two_point", made: true, playerId: "a" }),
      evt({ timestampSeconds: 1, eventType: "assist", playerId: "a" }),
      evt({ timestampSeconds: 2, eventType: "three_point", made: true, playerId: "b", teamSide: "opponent" }),
      evt({ timestampSeconds: 3, eventType: "timeout", teamSide: undefined, playerId: undefined }),
    ];
    const team = computeLiveStats(events, "team");
    expect(team).toEqual([{ playerId: "a", pts: 2, reb: 0, ast: 1, stl: 0, blk: 0, tov: 0, pf: 0 }]);
    const opponent = computeLiveStats(events, "opponent");
    expect(opponent).toEqual([{ playerId: "b", pts: 3, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }]);
  });

  it("rolls offensive/defensive/technical fouls all into pf", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "foul" }),
      evt({ timestampSeconds: 1, eventType: "offensive_foul" }),
      evt({ timestampSeconds: 2, eventType: "defensive_foul" }),
      evt({ timestampSeconds: 3, eventType: "technical_foul" }),
    ];
    expect(computeLiveStats(events, "team")[0].pf).toBe(4);
  });
});

describe("computePlayingTimeSeconds", () => {
  const oneQuarter: VideoSegment[] = [{ label: "Q1", startSeconds: 0, endSeconds: 600, clockRunning: false }];

  it("sums a full sub-in/sub-out stint", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "substitution_in", gameClockSeconds: 600 }),
      evt({ timestampSeconds: 590, eventType: "substitution_out", gameClockSeconds: 0 }),
    ];
    expect(computePlayingTimeSeconds(events, oneQuarter, "team").get("player-1")).toBe(600);
  });

  it("closes out a still-on-court player at the period buzzer", () => {
    const events: AnnotationEvent[] = [evt({ timestampSeconds: 0, eventType: "substitution_in", gameClockSeconds: 600 })];
    expect(computePlayingTimeSeconds(events, oneQuarter, "team").get("player-1")).toBe(600);
  });

  it("never counts stoppage time, since both sides of a stoppage share the same gameClockSeconds", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "substitution_in", gameClockSeconds: 600 }),
      evt({ timestampSeconds: 200, eventType: "substitution_out", gameClockSeconds: 450 }),
      evt({ timestampSeconds: 201, playerId: "player-2", eventType: "substitution_in", gameClockSeconds: 450 }),
      evt({ timestampSeconds: 590, playerId: "player-2", eventType: "substitution_out", gameClockSeconds: 0 }),
    ];
    const totals = computePlayingTimeSeconds(events, oneQuarter, "team");
    expect(totals.get("player-1")).toBe(150);
    expect(totals.get("player-2")).toBe(450);
  });

  it("accumulates across multiple periods", () => {
    const segments: VideoSegment[] = [
      { label: "Q1", startSeconds: 0, endSeconds: 600, clockRunning: false },
      { label: "Q2", startSeconds: 600, endSeconds: 1200, clockRunning: false },
    ];
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "substitution_in", gameClockSeconds: 600 }),
      evt({ timestampSeconds: 590, eventType: "substitution_out", gameClockSeconds: 0 }),
      evt({ timestampSeconds: 610, eventType: "substitution_in", gameClockSeconds: 600 }),
      evt({ timestampSeconds: 900, eventType: "substitution_out", gameClockSeconds: 300 }),
    ];
    expect(computePlayingTimeSeconds(events, segments, "team").get("player-1")).toBe(900);
  });

  it("skips events missing gameClockSeconds instead of crashing", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "substitution_in" }),
      evt({ timestampSeconds: 590, eventType: "substitution_out", gameClockSeconds: 0 }),
    ];
    expect(computePlayingTimeSeconds(events, oneQuarter, "team").get("player-1")).toBeUndefined();
  });
});

describe("computePlusMinus", () => {
  const oneQuarter: VideoSegment[] = [{ label: "Q1", startSeconds: 0, endSeconds: 600, clockRunning: false }];

  it("nets own-team and opponent scoring while the player is on court", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "substitution_in", gameClockSeconds: 600 }),
      evt({ timestampSeconds: 100, eventType: "two_point", made: true, gameClockSeconds: 500 }),
      evt({ timestampSeconds: 200, eventType: "free_throw", made: true, gameClockSeconds: 440 }),
      evt({ timestampSeconds: 150, eventType: "three_point", made: true, gameClockSeconds: 470, teamSide: "opponent", playerId: "opp-1" }),
      evt({ timestampSeconds: 590, eventType: "substitution_out", gameClockSeconds: 0 }),
    ];
    // team scored 2 + 1 = 3, opponent scored 3 -> net 0
    expect(computePlusMinus(events, oneQuarter, "team").get("player-1")).toBe(0);
  });

  it("excludes scoring that happens after the player has subbed out", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "substitution_in", gameClockSeconds: 600 }),
      evt({ timestampSeconds: 100, eventType: "two_point", made: true, gameClockSeconds: 500 }),
      evt({ timestampSeconds: 200, eventType: "substitution_out", gameClockSeconds: 400 }),
      evt({ timestampSeconds: 300, eventType: "three_point", made: true, gameClockSeconds: 300, teamSide: "opponent", playerId: "opp-1" }),
    ];
    expect(computePlusMinus(events, oneQuarter, "team").get("player-1")).toBe(2);
  });

  it("leaves a bench player who never entered untouched", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 100, eventType: "three_point", made: true, gameClockSeconds: 500, teamSide: "opponent", playerId: "opp-1" }),
    ];
    expect(computePlusMinus(events, oneQuarter, "team").get("player-1")).toBeUndefined();
  });
});
