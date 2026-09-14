"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
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
import { getSegments, saveSegments, periodForTimestamp, type VideoSegment } from "@/lib/portal/segments";
import VideoPlayer, { type VideoPlayerHandle } from "./VideoPlayer";
import EventsTimeline from "./EventsTimeline";
import CreateEventForm from "./CreateEventForm";
import EventsList from "./EventsList";
import LiveStatsPanel from "./LiveStatsPanel";
import RosterManager from "./RosterManager";
import SegmentVideo from "./SegmentVideo";
import SegmentStepper from "./SegmentStepper";

type Tab = "segments" | "annotate" | "stats" | "roster";

const TABS: { key: Tab; label: string }[] = [
  { key: "segments", label: "SEGMENTS" },
  { key: "annotate", label: "ANNOTATE" },
  { key: "stats", label: "LIVE STATS" },
  { key: "roster", label: "ROSTER" },
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
  const [duration, setDuration] = useState(0);
  const [editingEvent, setEditingEvent] = useState<AnnotationEvent | null>(null);
  const [tab, setTab] = useState<Tab>("segments");
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

  useEffect(() => {
    getEvents(project.id).then(setEvents);
    getSegments(project.id).then((s) => {
      setSegments(s);
      setTab(s ? "annotate" : "segments");
    });
    getProjectVideoUrl(project).then(setVideoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // "Claimed" is the only status this workspace is ever reached with while
  // still editable — once submitted ("In Review") or QA'd ("Completed"),
  // it's out of the annotator's hands (submission is a one-way door; see
  // lib/portal/pipeline.ts).
  const readOnly = annotationStatus !== "Claimed";
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

  function handleSeek(seconds: number) {
    videoRef.current?.seekTo(seconds);
    setCurrentTime(seconds);
  }

  async function handleSaveSegments(newSegments: VideoSegment[]) {
    await saveSegments(currentProject.id, newSegments);
    setSegments(newSegments);
    setActiveSegmentIndex(0);
    setTab("annotate");
  }

  function handleSelectSegment(index: number) {
    if (!segments) return;
    setActiveSegmentIndex(index);
    handleSeek(segments[index].startSeconds);
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
            {videoUrl ? (
              <VideoPlayer
                ref={videoRef}
                src={videoUrl}
                onTimeUpdate={setCurrentTime}
                onDurationChange={setDuration}
              />
            ) : (
              <div className="hs-panel flex aspect-video items-center justify-center text-sm text-text-faint">
                Loading video…
              </div>
            )}
            <EventsTimeline durationSeconds={duration} events={events} onSeek={handleSeek} segments={segments} />
          </div>

          <div className="flex flex-col gap-6">
            {tab === "segments" && (
              <SegmentVideo
                format={currentProject.format}
                duration={duration}
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
          <LiveStatsPanel project={currentProject} events={events} />
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
    </div>
  );
}
