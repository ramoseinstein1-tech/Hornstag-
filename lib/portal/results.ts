/**
 * REAL RESULTS COMPUTATION
 * ─────────────────────────────────────────────────────────────────
 * Converts a project's REAL tagged AnnotationEvents (lib/portal/events.ts)
 * into the same ProjectResults shape lib/portal/store.ts's getProjectResults()
 * fabricates from a seeded PRNG, so the client Results page (and its
 * teamTotals/toCsv/downloadCsv helpers) work unchanged regardless of which
 * source produced the data. Kept as its own file rather than folded into
 * events.ts or store.ts since it straddles both modules' types without
 * either needing to import the other.
 */

import {
  getEvents,
  EVENT_TYPE_LABELS,
  SHOT_EVENT_TYPES,
  pointsForEvent,
  computePlayingTimeSeconds,
  computePlusMinus,
  type AnnotationEvent,
  type TeamSide,
} from "./events";
import { getSegments, periodForTimestamp, type VideoSegment } from "./segments";
import type { Project, RosterPlayer, PlayerBoxScore, TaggedClip, ShotChartPoint, ProjectResults } from "./store";

function formatClipTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function computeBoxScoreForSide(
  roster: RosterPlayer[],
  events: AnnotationEvent[],
  segments: VideoSegment[],
  teamSide: TeamSide
): PlayerBoxScore[] {
  const playingTime = computePlayingTimeSeconds(events, segments, teamSide);
  const plusMinus = computePlusMinus(events, segments, teamSide);
  return roster.map((p) => {
    const own = events.filter((e) => e.teamSide === teamSide && e.playerId === p.id);
    const shots = own.filter((e) => e.eventType === "two_point" || e.eventType === "three_point");
    const threes = own.filter((e) => e.eventType === "three_point");

    return {
      number: p.number,
      name: p.name,
      pts: own.reduce((sum, e) => sum + pointsForEvent(e), 0),
      reb: own.filter((e) => e.eventType === "offensive_rebound" || e.eventType === "defensive_rebound").length,
      ast: own.filter((e) => e.eventType === "assist").length,
      stl: own.filter((e) => e.eventType === "steal").length,
      blk: own.filter((e) => e.eventType === "block").length,
      tov: own.filter((e) => e.eventType === "turnover").length,
      fga: shots.length,
      fgm: shots.filter((e) => e.made).length,
      tpa: threes.length,
      tpm: threes.filter((e) => e.made).length,
      minSeconds: playingTime.get(p.id) ?? 0,
      plusMinus: plusMinus.get(p.id) ?? 0,
    };
  });
}

/** Every tagged shot's court location for one side — visualized on the
 * client Results page's shot chart (components/client-portal/ShotChart.tsx).
 * Events tagged before a shot location existed, or without one for any
 * other reason, are silently skipped rather than plotted at (0,0). */
function computeShotChart(events: AnnotationEvent[], teamSide: TeamSide): ShotChartPoint[] {
  return events
    .filter((e) => e.teamSide === teamSide && SHOT_EVENT_TYPES.includes(e.eventType) && e.shotLocation)
    .map((e) => ({ x: e.shotLocation!.x, y: e.shotLocation!.y, made: !!e.made }));
}

function computeClips(project: Project, events: AnnotationEvent[], segments: VideoSegment[]): TaggedClip[] {
  const findPlayer = (teamSide: TeamSide, playerId: string) =>
    (teamSide === "team" ? project.roster : project.opponentRoster ?? []).find((r) => r.id === playerId);

  return [...events]
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .map((e) => {
      const player = e.teamSide && e.playerId ? findPlayer(e.teamSide, e.playerId) : undefined;
      const base = e.eventType === "custom" && e.customLabel ? e.customLabel : EVENT_TYPE_LABELS[e.eventType];
      const label = SHOT_EVENT_TYPES.includes(e.eventType) ? `${base} (${e.made ? "MADE" : "MISSED"})` : base;

      // Falls back to periodForTimestamp for events tagged before the
      // period column was fixed to actually persist (Phase 9) — without
      // this, those older events would never get a real clip.
      const periodLabel = e.period ?? periodForTimestamp(segments, e.timestampSeconds);
      const seg = periodLabel ? segments.find((s) => s.label === periodLabel) : undefined;

      return {
        id: e.id,
        label,
        time: formatClipTime(e.timestampSeconds),
        // Timeout (the only teamless/playerless event type) has no
        // player to attribute — "Team event" reads better than the
        // "Unknown player" wording meant for an actual lookup miss.
        player: e.teamSide ? (player ? `#${player.number} ${player.name}` : "Unknown player") : "Team event",
        confidence: 100,
        verified: true,
        clipPath: seg?.clipPath,
        clipOffsetSeconds: seg?.clipPath ? e.timestampSeconds - seg.startSeconds : undefined,
      };
    });
}

/** Real, annotator-tagged results for a project — used once a project is
 * "Completed" and has actual tagged events behind it. */
export async function computeRealResults(project: Project): Promise<ProjectResults> {
  const [events, segmentsOrNull] = await Promise.all([getEvents(project.id), getSegments(project.id)]);
  const segments = segmentsOrNull ?? [];
  const team = computeBoxScoreForSide(project.roster, events, segments, "team");
  const opponent =
    project.opponentRoster && project.opponentRoster.length > 0
      ? computeBoxScoreForSide(project.opponentRoster, events, segments, "opponent")
      : undefined;
  return {
    team,
    opponent,
    clips: computeClips(project, events, segments),
    teamShots: computeShotChart(events, "team"),
    opponentShots: project.opponentRoster && project.opponentRoster.length > 0 ? computeShotChart(events, "opponent") : undefined,
  };
}

export async function hasRealAnnotationData(projectId: string): Promise<boolean> {
  const events = await getEvents(projectId);
  return events.length > 0;
}
