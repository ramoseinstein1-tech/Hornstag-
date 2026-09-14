"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { updateRoster, type Project, type RosterPlayer } from "@/lib/portal/store";
import type { GlobalAnnotationStatus } from "@/lib/portal/globalProjects";
import {
  createEvent,
  deleteEvent,
  getEvents,
  pointsForEvent,
  updateEvent,
  type AnnotationEvent,
  type NewEventInput,
} from "@/lib/portal/events";
import { getSegments, saveSegments, type VideoSegment } from "@/lib/portal/segments";
import VideoPlayer, { type VideoPlayerHandle } from "./VideoPlayer";
import EventsTimeline from "./EventsTimeline";
import CreateEventForm from "./CreateEventForm";
import EventsList from "./EventsList";
import LiveStatsPanel from "./LiveStatsPanel";
import RosterManager from "./RosterManager";
import SegmentVideo from "./SegmentVideo";

const SAMPLE_VIDEO_SRC = "/annotator-sample.mp4";

type Tab = "segments" | "annotate" | "stats" | "roster";

const TABS: { key: Tab; label: string }[] = [
  { key: "segments", label: "SEGMENTS" },
  { key: "annotate", label: "ANNOTATE" },
  { key: "stats", label: "LIVE STATS" },
  { key: "roster", label: "ROSTER" },
];

export default function AnnotationWorkspace({
  project,
  ownerId,
  annotationStatus,
}: {
  project: Project;
  ownerId: string;
  annotationStatus: GlobalAnnotationStatus;
}) {
  const videoRef = useRef<VideoPlayerHandle>(null);
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [events, setEvents] = useState<AnnotationEvent[]>(() => getEvents(project.id));
  const [segments, setSegments] = useState<VideoSegment[] | null>(() => getSegments(project.id));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [editingEvent, setEditingEvent] = useState<AnnotationEvent | null>(null);
  const [tab, setTab] = useState<Tab>(segments ? "annotate" : "segments");

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

  function handleSaveSegments(newSegments: VideoSegment[]) {
    saveSegments(currentProject.id, newSegments);
    setSegments(newSegments);
    setTab("annotate");
  }

  function handleSave(input: NewEventInput): { ok: boolean; error?: string } {
    if (editingEvent) {
      const result = updateEvent(currentProject.id, editingEvent.id, input);
      if (result.ok) setEvents(getEvents(currentProject.id));
      return result;
    }
    const result = createEvent(currentProject.id, input);
    if (result.ok) setEvents(getEvents(currentProject.id));
    return result;
  }

  function handleDelete(eventId: string) {
    deleteEvent(currentProject.id, eventId);
    setEvents(getEvents(currentProject.id));
    if (editingEvent?.id === eventId) setEditingEvent(null);
  }

  function handleSaveRoster(roster: RosterPlayer[], opponentRoster?: RosterPlayer[]) {
    const updated = updateRoster(ownerId, currentProject.id, roster, opponentRoster);
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

      <p className="mt-3 max-w-xl text-xs leading-relaxed text-text-faint">
        This demo doesn&rsquo;t store the project&rsquo;s real uploaded footage — every
        workspace plays a shared sample clip so you can test tagging end-to-end.
      </p>

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
            <VideoPlayer
              ref={videoRef}
              src={SAMPLE_VIDEO_SRC}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
            />
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
                  {readOnly ? (
                    <div className="hs-panel p-5 text-center text-sm text-text-muted">{lockedMessage}</div>
                  ) : (
                    <CreateEventForm
                      project={currentProject}
                      currentTimeSeconds={currentTime}
                      editingEvent={editingEvent}
                      onSave={handleSave}
                      onCancelEdit={() => setEditingEvent(null)}
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
