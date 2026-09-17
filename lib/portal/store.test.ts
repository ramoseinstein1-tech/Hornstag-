import { describe, expect, it } from "vitest";
import { officialOutcome, teamTotals, formatFileSize, type PlayerBoxScore } from "./store";

describe("officialOutcome", () => {
  it("picks the higher score's side, or a tie", () => {
    expect(officialOutcome({ team: 80, opponent: 70 })).toBe("team");
    expect(officialOutcome({ team: 70, opponent: 80 })).toBe("opponent");
    expect(officialOutcome({ team: 75, opponent: 75 })).toBe("tie");
  });
});

function player(partial: Partial<PlayerBoxScore>): PlayerBoxScore {
  return {
    number: "0",
    name: "Player",
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    minSeconds: 0,
    plusMinus: 0,
    ...partial,
  };
}

describe("teamTotals", () => {
  it("sums counting stats and computes shooting percentages", () => {
    const totals = teamTotals([
      player({ pts: 10, reb: 5, fgm: 4, fga: 8, tpm: 2, tpa: 5 }),
      player({ pts: 6, reb: 3, fgm: 2, fga: 4, tpm: 0, tpa: 1 }),
    ]);
    expect(totals.pts).toBe(16);
    expect(totals.reb).toBe(8);
    expect(totals.fgm).toBe(6);
    expect(totals.fga).toBe(12);
    expect(totals.fgPct).toBe(50); // 6/12
    expect(totals.tpPct).toBe(33.3); // 2/6, rounded to one decimal
  });

  it("reports 0% rather than dividing by zero with no attempts", () => {
    const totals = teamTotals([player({})]);
    expect(totals.fgPct).toBe(0);
    expect(totals.tpPct).toBe(0);
  });
});

describe("formatFileSize", () => {
  it("uses KB under 1MB and MB above it", () => {
    expect(formatFileSize(500 * 1024)).toBe("500 KB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});
