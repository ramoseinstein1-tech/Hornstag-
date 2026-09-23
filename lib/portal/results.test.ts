import { describe, expect, it } from "vitest";
import { formatClipTime, computeBoxScoreForSide, computeHeartStatsBoxScore, computeShotChart, computeClips } from "./results";
import type { AnnotationEvent } from "./events";
import type { VideoSegment } from "./segments";
import type { Project, RosterPlayer } from "./store";

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

function project(partial: Partial<Project> & Pick<Project, "roster">): Project {
  return {
    id: "p1",
    ownerId: "owner-1",
    ownerName: "Owner",
    name: "Test Game",
    scope: "Both Teams",
    annotationKind: "traditional",
    format: "Quarters",
    opponentRoster: [],
    videoCleared: false,
    status: "Completed",
    progress: 100,
    annotationStatus: "Completed",
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const player1: RosterPlayer = { id: "player-1", number: "10", name: "Dame" };
const opp1: RosterPlayer = { id: "opp-1", number: "00", name: "Avi" };

describe("formatClipTime", () => {
  it("omits the hour segment under an hour", () => {
    expect(formatClipTime(65)).toBe("1:05");
  });

  it("includes the hour segment past an hour", () => {
    expect(formatClipTime(3665)).toBe("1:01:05");
  });
});

describe("computeBoxScoreForSide", () => {
  it("tallies a roster player's own events only", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "two_point", made: true, playerId: "player-1" }),
      evt({ timestampSeconds: 1, eventType: "three_point", made: true, playerId: "player-1" }),
      evt({ timestampSeconds: 2, eventType: "assist", playerId: "player-1" }),
      evt({ timestampSeconds: 3, eventType: "three_point", made: true, playerId: "opp-1", teamSide: "opponent" }),
    ];
    const [box] = computeBoxScoreForSide([player1], events, [], "team");
    expect(box.pts).toBe(5); // 2 + 3
    expect(box.ast).toBe(1);
    expect(box.fga).toBe(2);
    expect(box.fgm).toBe(2);
    expect(box.tpa).toBe(1);
    expect(box.tpm).toBe(1);
  });

  it("includes a roster player with zero events at zero, not omitted", () => {
    const [box] = computeBoxScoreForSide([player1], [], [], "team");
    expect(box).toMatchObject({ number: "10", name: "Dame", pts: 0, minSeconds: 0, plusMinus: 0 });
  });
});

describe("computeHeartStatsBoxScore", () => {
  it("tallies hustle-stat counts per player, box_out split by made/attempted", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "deflection", playerId: "player-1" }),
      evt({ timestampSeconds: 1, eventType: "deflection", playerId: "player-1" }),
      evt({ timestampSeconds: 2, eventType: "loose_ball_recovered", playerId: "player-1" }),
      evt({ timestampSeconds: 3, eventType: "box_out", playerId: "player-1", made: true }),
      evt({ timestampSeconds: 4, eventType: "box_out", playerId: "player-1", made: false }),
      evt({ timestampSeconds: 5, eventType: "charge_drawn", playerId: "opp-1", teamSide: "opponent" }),
    ];
    const [box] = computeHeartStatsBoxScore([player1], events, "team");
    expect(box.deflections).toBe(2);
    expect(box.looseBallsRecovered).toBe(1);
    expect(box.boxOutsWon).toBe(1);
    expect(box.boxOutsAttempted).toBe(2);
    expect(box.chargesDrawn).toBe(0);
  });

  it("includes a roster player with zero events at zero, not omitted", () => {
    const [box] = computeHeartStatsBoxScore([player1], [], "team");
    expect(box).toMatchObject({ number: "10", name: "Dame", deflections: 0, boxOutsAttempted: 0 });
  });
});

describe("computeShotChart", () => {
  it("only plots shots with a location, skipping non-shots and locationless events", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "two_point", made: true, shotLocation: { x: 0.2, y: 0.5 } }),
      evt({ timestampSeconds: 1, eventType: "three_point", made: false, shotLocation: { x: 0.8, y: 0.3 } }),
      evt({ timestampSeconds: 2, eventType: "two_point", made: true }), // no shotLocation
      evt({ timestampSeconds: 3, eventType: "assist" }), // not a shot type
    ];
    const shots = computeShotChart(events, "team");
    expect(shots).toEqual([
      { x: 0.2, y: 0.5, made: true },
      { x: 0.8, y: 0.3, made: false },
    ]);
  });

  it("keeps each team's shots separate", () => {
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 0, eventType: "two_point", made: true, shotLocation: { x: 0.5, y: 0.5 }, teamSide: "opponent", playerId: "opp-1" }),
    ];
    expect(computeShotChart(events, "team")).toEqual([]);
    expect(computeShotChart(events, "opponent")).toEqual([{ x: 0.5, y: 0.5, made: true }]);
  });
});

describe("computeClips", () => {
  const segments: VideoSegment[] = [
    { label: "Q1", startSeconds: 0, endSeconds: 600, clockRunning: false, clipPath: "games/p1/segments/Q1.mp4" },
  ];

  it("attaches a clip path and in-period offset when the event's period was cut", () => {
    const proj = project({ roster: [player1] });
    const events: AnnotationEvent[] = [evt({ timestampSeconds: 130, eventType: "steal", period: "Q1" })];
    const [clip] = computeClips(proj, events, segments);
    expect(clip.clipPath).toBe("games/p1/segments/Q1.mp4");
    expect(clip.clipOffsetSeconds).toBe(130);
  });

  it("falls back to periodForTimestamp when the event predates the period column fix", () => {
    const proj = project({ roster: [player1] });
    const events: AnnotationEvent[] = [evt({ timestampSeconds: 200, eventType: "steal", period: undefined })];
    const [clip] = computeClips(proj, events, segments);
    expect(clip.clipPath).toBe("games/p1/segments/Q1.mp4");
    expect(clip.clipOffsetSeconds).toBe(200);
  });

  it("leaves clipPath undefined when that period was never cut", () => {
    const proj = project({ roster: [player1] });
    const events: AnnotationEvent[] = [evt({ timestampSeconds: 130, eventType: "steal", period: "Q1" })];
    const [clip] = computeClips(proj, events, [{ label: "Q1", startSeconds: 0, endSeconds: 600, clockRunning: false }]);
    expect(clip.clipPath).toBeUndefined();
    expect(clip.clipOffsetSeconds).toBeUndefined();
  });

  it("labels a teamless timeout as a team event with no player", () => {
    const proj = project({ roster: [player1] });
    const events: AnnotationEvent[] = [evt({ timestampSeconds: 50, eventType: "timeout", teamSide: undefined, playerId: undefined, period: "Q1" })];
    const [clip] = computeClips(proj, events, segments);
    expect(clip.player).toBe("Team event");
  });

  it("labels an unrecognized player id as unknown, not a crash", () => {
    const proj = project({ roster: [player1] });
    const events: AnnotationEvent[] = [evt({ timestampSeconds: 50, eventType: "steal", playerId: "ghost", period: "Q1" })];
    const [clip] = computeClips(proj, events, segments);
    expect(clip.player).toBe("Unknown player");
  });

  it("looks up opponent-side players from the opponent roster", () => {
    const proj = project({ roster: [player1], opponentRoster: [opp1] });
    const events: AnnotationEvent[] = [
      evt({ timestampSeconds: 50, eventType: "steal", teamSide: "opponent", playerId: "opp-1", period: "Q1" }),
    ];
    const [clip] = computeClips(proj, events, segments);
    expect(clip.player).toBe("#00 Avi");
  });
});
