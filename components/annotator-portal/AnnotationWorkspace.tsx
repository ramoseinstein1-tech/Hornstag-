"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateRoster, getProjectVideoUrl, type AnnotationStatus, type Project, type RosterPlayer } from "@/lib/portal/store";
import {
  createEvent,
  deleteEvent,
  getEvents,
  pointsForEvent,
  updateEvent,
  type AnnotationEvent,
  type NewEventInput,
} from "@/lib/portal/events";
import {
  getSegments,
  saveSegments,
  getSegmentClipUrl,
  periodForTimestamp,
  startPeriodClock,
  pausePeriodClock,
  resumePeriodClock,
  type VideoSegment,
} from "@/lib/portal/segments";
import { cutProjectIntoClips, type ClipProgress } from "@/lib/portal/videoClips";
import { getVideoIssues, type VideoIssue } from "@/lib/portal/videoIssues";
import VideoPlayer, { type VideoPlayerHandle } from "./VideoPlayer";
import EventsTimeline from "./EventsTimeline";
import CreateEventForm from "./CreateEventForm";
import EventsList from "./EventsList";
import LiveStatsPanel from "./LiveStatsPanel";
import RosterManager from "./RosterManager";
import SegmentVideo from "./SegmentVideo";
import SegmentStepper from "./SegmentStepper";
import GameClockPanel from "./GameClockPanel";
import VideoIssuesPanel from "./VideoIssuesPanel";

type Tab = "segments" | "annotate" | "stats" | "roster" | "issues";

const TABS: { key: Tab; label: string }[] = [
  { key: "segments", label: "SEGMENTS" },
  { key: "annotate", label: "ANNOTATE" },
  { key: "stats", label: "LIVE STATS" },
  { key: "roster", label: "ROSTER" },
  { key: "issues", label: "ISSUES" },
];

export default function AnnotationWorkspace({
  project,
  annotationStatus,
}: {
  project: Project;
  annotationStatus: AnnotationStatus;
}) {
  const videoRef = useRef<VideoPlayerHandle>(null);
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [events, setEvents] = useState<AnnotationEvent[]>([]);
  const [segments, setSegments] = useState<VideoSegment[] | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  // Pinned to the FULL source video's duration — used by EventsTimeline
  // and SegmentVideo, both of which reason about the whole game
  // regardless of whether a shorter per-period clip happens to be
  // loaded for active tagging right now (see fullDuration handling in
  // handlePlayerDurationChange below).
  const [fullDuration, setFullDuration] = useState(0);
  const [editingEvent, setEditingEvent] = useState<AnnotationEvent | null>(null);
  const [tab, setTab] = useState<Tab>("segments");
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

  // Phase 3: while tagging, the ANNOTATE tab prefers playing a period's
  // own short clip (once cut) over scrubbing the full source video.
  // `activeClip` is null when showing the full video. `currentTime` and
  // `handleSeek` always deal in FULL-VIDEO-ABSOLUTE seconds regardless
  // of which is actually loaded — annotation_events.timestamp_seconds
  // has always meant "seconds into the full game," and that can't change
  // just because a shorter clip happens to be playing right now.
  const [activeClip, setActiveClip] = useState<{ label: string; offset: number; duration: number } | null>(null);
  const [playerSrc, setPlayerSrc] = useState<string | null>(null);
  const [playerSeekTarget, setPlayerSeekTarget] = useState<number | undefined>(undefined);
  const [cuttingProgress, setCuttingProgress] = useState<ClipProgress | null>(null);
  const [cuttingError, setCuttingError] = useState<string | null>(null);
  const [videoIssues, setVideoIssues] = useState<VideoIssue[]>([]);
  const clipUrlCacheRef = useRef<Map<string, string>>(new Map());
  const { user } = useAuth();

  // The SEGMENTS tab always needs the full video (marking period
  // boundaries requires scrubbing the whole thing) — only the ANNOTATE
  // tab ever loads a clip.
  const effectiveActiveClip = tab === "annotate" ? activeClip : null;
  const effectiveSrc = tab === "segments" ? videoUrl : (playerSrc ?? videoUrl);

  useEffect(() => {
    getEvents(project.id).then(setEvents);
    getSegments(project.id).then((s) => {
      setSegments(s);
      setTab(s ? "annotate" : "segments");
    });
    // A cleared source (deleted once every period had a real clip — see
    // lib/portal/pipeline.ts's approveAndComplete) has no videoPath
    // either, same as a project that never had a real upload — skip the
    // call so a reopened project doesn't fall back to the unrelated
    // sample clip and look like real footage.
    if (!project.videoCleared) {
      getProjectVideoUrl(project).then((url) => {
        setVideoUrl(url);
        setPlayerSrc(url);
      });
    }
    getVideoIssues(project.id).then(setVideoIssues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // "Claimed" and "Correction Required" are the only statuses the
  // annotator can still edit under — matching exactly what the
  // submit_for_review RPC itself accepts a submission from (see
  // supabase/migrations/00000000000015_correction_required.sql). Once
  // submitted ("In Review") or QA'd ("Completed"), it's out of the
  // annotator's hands (submission is a one-way door; see
  // lib/portal/pipeline.ts) — RLS enforces this same boundary at the
  // database level too, not just here.
  const readOnly = annotationStatus !== "Claimed" && annotationStatus !== "Correction Required";
  const lockedMessage =
    annotationStatus === "Completed"
      ? "This match has been reviewed and completed — no further edits."
      : "Submitted for review — no further edits until QA responds.";
  const tabs = readOnly ? TABS.filter((t) => t.key !== "roster" && t.key !== "segments") : TABS;

  const teamScore = useMemo(
    () => events.filter((e) => e.teamSide === "team").reduce((sum, e) => sum + pointsForEvent(e), 0),
    [events]
  );
  const opponentScore = useMemo(
    () => events.filter((e) => e.teamSide === "opponent").reduce((sum, e) => sum + pointsForEvent(e), 0),
    [events]
  );

  function handlePlayerTimeUpdate(raw: number) {
    setCurrentTime(effectiveActiveClip ? effectiveActiveClip.offset + raw : raw);
  }

  function handlePlayerDurationChange(raw: number) {
    // A clip's own (short) duration must never overwrite the
    // full-game duration EventsTimeline/SegmentVideo rely on.
    if (effectiveActiveClip) return;
    setFullDuration(raw);
  }

  /** Absolute (full-video-relative) seek — from EventsTimeline,
   * EventsList, or "USE CURRENT". Stays on the active clip when the
   * target falls inside it; otherwise falls back to the full source
   * video, since a clip only covers its own period. */
  function handleSeek(absoluteSeconds: number) {
    if (activeClip) {
      const relative = absoluteSeconds - activeClip.offset;
      if (relative >= 0 && relative < activeClip.duration) {
        videoRef.current?.seekTo(relative);
        setCurrentTime(absoluteSeconds);
        return;
      }
      setActiveClip(null);
      setPlayerSrc(videoUrl);
      setPlayerSeekTarget(absoluteSeconds);
      setCurrentTime(absoluteSeconds);
      return;
    }
    videoRef.current?.seekTo(absoluteSeconds);
    setCurrentTime(absoluteSeconds);
  }

  async function handleSaveSegments(newSegments: VideoSegment[]) {
    await saveSegments(currentProject.id, newSegments);
    setSegments(newSegments);
    setActiveSegmentIndex(0);
    setActiveClip(null);
    setPlayerSrc(videoUrl);
    setTab("annotate");

    if (currentProject.videoPath) {
      setCuttingError(null);
      cutProjectIntoClips(currentProject, newSegments, (progress) => {
        setCuttingProgress(progress.index < progress.total ? progress : null);
      })
        .then(async (result) => {
          if (!result.ok) {
            setCuttingError(result.error);
            return;
          }
          if (result.failedLabels.length > 0) {
            const detail = result.firstFailureDetail ? ` (${result.firstFailureDetail})` : "";
            setCuttingError(`Cut ${result.cutCount} of ${newSegments.length} clips — ${result.failedLabels.join(", ")} failed${detail} and will use the full video instead.`);
          }
          setSegments(await getSegments(currentProject.id));
        })
        .catch((err) => {
          console.error("cutProjectIntoClips rejected unexpectedly:", err);
          setCuttingError(err instanceof Error ? err.message : "Cutting into clips failed unexpectedly.");
        });
    }
  }

  async function handleSelectSegment(index: number) {
    if (!segments) return;
    setActiveSegmentIndex(index);
    const seg = segments[index];

    let clipUrl: string | null = null;
    if (seg.clipPath) {
      clipUrl = clipUrlCacheRef.current.get(seg.clipPath) ?? null;
      if (!clipUrl) {
        clipUrl = await getSegmentClipUrl(currentProject.id, seg.clipPath);
        if (clipUrl) clipUrlCacheRef.current.set(seg.clipPath, clipUrl);
      }
    }

    if (clipUrl) {
      if (playerSrc === clipUrl) {
        videoRef.current?.seekTo(0);
      } else {
        setActiveClip({ label: seg.label, offset: seg.startSeconds, duration: seg.endSeconds - seg.startSeconds });
        setPlayerSrc(clipUrl);
        setPlayerSeekTarget(0);
      }
      setCurrentTime(seg.startSeconds);
      return;
    }

    // No clip yet (still cutting, or it failed) — fall back to seeking
    // within the full video, same as before Phase 3.
    if (playerSrc === videoUrl) {
      videoRef.current?.seekTo(seg.startSeconds);
    } else {
      setActiveClip(null);
      setPlayerSrc(videoUrl);
      setPlayerSeekTarget(seg.startSeconds);
    }
    setCurrentTime(seg.startSeconds);
  }

  function updateActiveSegment(patch: Partial<VideoSegment>) {
    setSegments((prev) => prev && prev.map((s, i) => (i === activeSegmentIndex ? { ...s, ...patch } : s)));
  }

  async function handleStartClock(startValueSeconds: number) {
    if (!segments) return;
    const seg = segments[activeSegmentIndex];
    await startPeriodClock(currentProject.id, seg.label, startValueSeconds, currentTime);
    updateActiveSegment({ clockReferenceVideoSeconds: currentTime, clockReferenceValueSeconds: startValueSeconds, clockRunning: true });
  }

  async function handlePauseClock(frozenValueSeconds: number) {
    if (!segments) return;
    const seg = segments[activeSegmentIndex];
    await pausePeriodClock(currentProject.id, seg.label, frozenValueSeconds);
    updateActiveSegment({ clockReferenceValueSeconds: frozenValueSeconds, clockRunning: false });
  }

  async function handleResumeClock() {
    if (!segments) return;
    const seg = segments[activeSegmentIndex];
    await resumePeriodClock(currentProject.id, seg.label, currentTime);
    updateActiveSegment({ clockReferenceVideoSeconds: currentTime, clockRunning: true });
  }

  async function handleSave(input: NewEventInput): Promise<{ ok: boolean; error?: string }> {
    const period = segments ? periodForTimestamp(segments, input.timestampSeconds) : undefined;
    const enrichedInput: NewEventInput = { ...input, period };
    if (editingEvent) {
      const result = await updateEvent(currentProject.id, editingEvent.id, enrichedInput);
      if (result.ok) setEvents(await getEvents(currentProject.id));
      return result;
    }
    const result = await createEvent(currentProject.id, enrichedInput);
    if (result.ok) setEvents(await getEvents(currentProject.id));
    return result;
  }

  async function handleDelete(eventId: string) {
    await deleteEvent(currentProject.id, eventId);
    setEvents(await getEvents(currentProject.id));
    if (editingEvent?.id === eventId) setEditingEvent(null);
  }

  async function handleSaveRoster(roster: RosterPlayer[], opponentRoster?: RosterPlayer[]) {
    const updated = await updateRoster(currentProject.id, roster, opponentRoster);
    if (updated) setCurrentProject(updated);
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">ANNOTATOR PORTAL</p>
          <h1 className="display-md uppercase">
            <span className="text-gradient">{currentProject.name}</span>
          </h1>
        </div>
        <div className="hs-panel flex gap-6 px-5 py-3">
          <div className="text-center">
            <p className="font-display text-xl font-semibold text-orange-bright">{teamScore}</p>
            <p className="font-mono-tech text-[0.56rem] tracking-[0.14em] text-text-faint">TAGGED TEAM</p>
          </div>
          <div className="text-center">
            <p className="font-display text-xl font-semibold text-text">{opponentScore}</p>
            <p className="font-mono-tech text-[0.56rem] tracking-[0.14em] text-text-faint">TAGGED OPP</p>
          </div>
          {currentProject.officialScore && (
            <div className="border-l border-border pl-6 text-center">
              <p className="font-display text-xl font-semibold text-text">
                {currentProject.officialScore.team}–{currentProject.officialScore.opponent}
              </p>
              <p className="font-mono-tech text-[0.56rem] tracking-[0.14em] text-text-faint">OFFICIAL</p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-2 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
        {currentProject.format.toUpperCase()} GAME
        {currentProject.officialScore &&
          ` · TAG TOWARD THE OFFICIAL SCORE — QA CHECKS THAT YOUR TAGGED EVENTS ADD UP TO ${currentProject.officialScore.team}–${currentProject.officialScore.opponent} BEFORE APPROVING`}
      </p>

      {!currentProject.videoPath && (
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-text-faint">
          No real footage was uploaded for this project — playing a shared sample clip
          so you can still test tagging end-to-end.
        </p>
      )}

      {cuttingProgress && (
        <p className="mt-3 flex items-center gap-2 font-mono-tech text-[0.6rem] tracking-[0.1em] text-orange-bright">
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange/30 border-t-orange" />
          CUTTING INTO PERIOD CLIPS — {cuttingProgress.label.toUpperCase()} ({cuttingProgress.index + 1}/{cuttingProgress.total})
        </p>
      )}

      {cuttingError && (
        <p className="mt-3 max-w-xl font-mono-tech text-[0.6rem] leading-relaxed tracking-[0.06em] text-[#ff9b9b]">
          ⚠ {cuttingError}
        </p>
      )}

      <div className="mt-8 flex gap-1.5 border-b border-border">
        {tabs.map((t) => {
          const locked = t.key === "annotate" && !segments;
          return (
            <button
              key={t.key}
              type="button"
              disabled={locked}
              onClick={() => !locked && setTab(t.key)}
              title={locked ? "Segment the video first" : undefined}
              className={`relative px-4 py-3 font-mono-tech text-[0.64rem] tracking-[0.14em] transition-colors ${
                locked
                  ? "cursor-not-allowed text-text-faint/40"
                  : tab === t.key
                    ? "text-orange-bright"
                    : "text-text-faint hover:text-text-muted"
              }`}
            >
              {t.label}
              {locked && " \u{1F512}"}
              {tab === t.key && (
                <motion.span
                  layoutId="workspace-tab-underline"
                  className="absolute inset-x-0 -bottom-px h-[2px] bg-orange"
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>

      {(tab === "segments" || tab === "annotate") && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-4">
            {effectiveSrc ? (
              <VideoPlayer
                ref={videoRef}
                src={effectiveSrc}
                seekOnLoadSeconds={playerSeekTarget}
                onTimeUpdate={handlePlayerTimeUpdate}
                onDurationChange={handlePlayerDurationChange}
              />
            ) : (
              <div className="hs-panel flex aspect-video items-center justify-center text-sm text-text-faint">
                {project.videoCleared ? "Source video was cleared after approval." : "Loading video…"}
              </div>
            )}
            {effectiveActiveClip && (
              <p className="font-mono-tech text-[0.58rem] tracking-[0.1em] text-text-faint">
                PLAYING {effectiveActiveClip.label.toUpperCase()} CLIP — click any tagged event or a different
                period to jump elsewhere in the full game.
              </p>
            )}
            {tab === "annotate" && !readOnly && segments && segments[activeSegmentIndex] && (
              <GameClockPanel
                segment={segments[activeSegmentIndex]}
                currentTimeSeconds={currentTime}
                onStart={handleStartClock}
                onPause={handlePauseClock}
                onResume={handleResumeClock}
              />
            )}
            <EventsTimeline durationSeconds={fullDuration} events={events} onSeek={handleSeek} segments={segments} />
          </div>

          <div className="flex flex-col gap-6">
            {tab === "segments" && (
              <SegmentVideo
                format={currentProject.format}
                duration={fullDuration}
                currentTimeSeconds={currentTime}
                existing={segments}
                onSave={handleSaveSegments}
              />
            )}

            {tab === "annotate" && (
              segments ? (
                <>
                  <SegmentStepper
                    segments={segments}
                    activeIndex={activeSegmentIndex}
                    events={events}
                    onSelect={handleSelectSegment}
                  />
                  {readOnly ? (
                    <div className="hs-panel p-5 text-center text-sm text-text-muted">{lockedMessage}</div>
                  ) : (
                    <CreateEventForm
                      project={currentProject}
                      segments={segments}
                      currentTimeSeconds={currentTime}
                      editingEvent={editingEvent}
                      onSave={handleSave}
                      onCancelEdit={() => setEditingEvent(null)}
                      activeSegmentLabel={segments[activeSegmentIndex]?.label}
                    />
                  )}
                  <EventsList
                    project={currentProject}
                    events={events}
                    onSeek={handleSeek}
                    onEdit={readOnly ? undefined : setEditingEvent}
                    onDelete={readOnly ? undefined : handleDelete}
                    readOnly={readOnly}
                  />
                </>
              ) : (
                <div className="hs-panel p-5 text-center text-sm text-text-muted">
                  Segment the video first — see the SEGMENTS tab.
                </div>
              )
            )}
          </div>
        </div>
      )}

      {tab === "stats" && (
        <div className="mt-6">
          <LiveStatsPanel project={currentProject} events={events} segments={segments} />
        </div>
      )}

      {tab === "roster" && !readOnly && (
        <div className="mt-6">
          <RosterManager
            scope={currentProject.scope}
            roster={currentProject.roster}
            opponentRoster={currentProject.opponentRoster}
            onSave={handleSaveRoster}
          />
        </div>
      )}

      {tab === "issues" && user && (
        <div className="mt-6">
          <VideoIssuesPanel
            projectId={currentProject.id}
            issues={videoIssues}
            currentTimeSeconds={currentTime}
            reporterName={user.name}
            reporterRole={user.role}
            currentUserId={user.id}
            isAdmin={false}
            onChange={async () => setVideoIssues(await getVideoIssues(currentProject.id))}
          />
        </div>
      )}
    </div>
  );
}
