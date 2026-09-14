"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { getProjects } from "@/lib/portal/store";
import { getGlobalProjectByProjectId } from "@/lib/portal/globalProjects";
import { getEvents, pointsForEvent } from "@/lib/portal/events";
import { getSegments } from "@/lib/portal/segments";
import { approveAndComplete, sendBackToAnnotator, reopenForReview } from "@/lib/portal/pipeline";
import VideoPlayer, { type VideoPlayerHandle } from "@/components/annotator-portal/VideoPlayer";
import EventsTimeline from "@/components/annotator-portal/EventsTimeline";
import EventsList from "@/components/annotator-portal/EventsList";
import LiveStatsPanel from "@/components/annotator-portal/LiveStatsPanel";

export default function AdminProjectReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const videoRef = useRef<VideoPlayerHandle>(null);
  const [duration, setDuration] = useState(0);
  // Unread on purpose — bumping it forces a re-render so a fresh read of
  // the global index (not memoized) is picked up right after a QA action.
  const [, setRefreshKey] = useState(0);

  const entry = getGlobalProjectByProjectId(projectId);
  const project = entry ? getProjects(entry.ownerId).find((p) => p.id === entry.projectId) : undefined;

  if (!entry || !project) {
    return (
      <div className="hs-panel mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-text-muted">This project couldn&rsquo;t be found.</p>
        <Link href="/admin-portal/projects" className="hs-btn-secondary mt-5 inline-flex">
          BACK TO PROJECTS
        </Link>
      </div>
    );
  }

  const events = getEvents(project.id);
  const segments = getSegments(project.id);
  const ownerId = entry.ownerId;
  const taggedTeamScore = events.filter((e) => e.teamSide === "team").reduce((sum, e) => sum + pointsForEvent(e), 0);
  const taggedOpponentScore = events
    .filter((e) => e.teamSide === "opponent")
    .reduce((sum, e) => sum + pointsForEvent(e), 0);
  const teamScoreMatches = project.officialScore ? taggedTeamScore === project.officialScore.team : null;
  const opponentScoreMatches = project.officialScore ? taggedOpponentScore === project.officialScore.opponent : null;

  function handleSeek(seconds: number) {
    videoRef.current?.seekTo(seconds);
  }

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  function handleApprove() {
    approveAndComplete(ownerId, projectId);
    refresh();
  }
  function handleSendBack() {
    sendBackToAnnotator(ownerId, projectId);
    refresh();
  }
  function handleReopen() {
    reopenForReview(ownerId, projectId);
    refresh();
  }

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display-md uppercase">
          <span className="text-gradient">{project.name}</span>
        </h1>
        <span className="hs-chip">{entry.annotationStatus.toUpperCase()}</span>
      </div>
      <p className="mt-1 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
        OWNER {entry.ownerName.toUpperCase()} · {project.format.toUpperCase()}
        {entry.claimedBy && ` · ANNOTATED BY ${entry.claimedBy.annotatorName.toUpperCase()}`}
        {` · ${events.length} EVENTS`}
        {segments ? " · VIDEO SEGMENTED" : " · VIDEO NOT YET SEGMENTED"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <VideoPlayer
            ref={videoRef}
            src="/annotator-sample.mp4"
            onDurationChange={setDuration}
          />
          <EventsTimeline durationSeconds={duration} events={events} onSeek={handleSeek} segments={segments} />
        </div>

        <div className="flex flex-col gap-6">
          <EventsList project={project} events={events} onSeek={handleSeek} readOnly />

          {project.officialScore && (
            <div className="hs-panel p-4">
              <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">SCORE CHECK</p>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="font-mono-tech text-[0.56rem] tracking-[0.1em] text-text-faint">OFFICIAL</p>
                  <p className="font-display text-lg font-semibold text-text">
                    {project.officialScore.team}–{project.officialScore.opponent}
                  </p>
                </div>
                <div>
                  <p className="font-mono-tech text-[0.56rem] tracking-[0.1em] text-text-faint">TAGGED</p>
                  <p className="font-display text-lg font-semibold text-text">
                    {taggedTeamScore}–{taggedOpponentScore}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`font-mono-tech text-[0.62rem] ${teamScoreMatches ? "text-[#7cd48a]" : "text-[#ff9b9b]"}`}>
                    {teamScoreMatches ? "✓ TEAM MATCHES" : "⚠ TEAM MISMATCH"}
                  </span>
                  {project.scope === "Both Teams" ? (
                    <span className={`font-mono-tech text-[0.62rem] ${opponentScoreMatches ? "text-[#7cd48a]" : "text-[#ff9b9b]"}`}>
                      {opponentScoreMatches ? "✓ OPPONENT MATCHES" : "⚠ OPPONENT MISMATCH"}
                    </span>
                  ) : (
                    <span className="font-mono-tech text-[0.62rem] text-text-faint">
                      OPPONENT NOT TRACKED (SINGLE TEAM SCOPE)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="hs-panel p-4">
            {entry.annotationStatus === "In Review" && (
              <div className="flex flex-wrap gap-2.5">
                <button onClick={handleApprove} className="hs-btn-primary">
                  APPROVE &amp; COMPLETE
                </button>
                <button onClick={handleSendBack} className="hs-btn-secondary">
                  SEND BACK TO ANNOTATOR
                </button>
              </div>
            )}
            {entry.annotationStatus === "Completed" && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="hs-chip !border-orange/50 !text-orange-bright">COMPLETED — RELAYED TO CLIENT</span>
                <button onClick={handleReopen} className="hs-btn-ghost">
                  REOPEN FOR REVIEW
                </button>
              </div>
            )}
            {(entry.annotationStatus === "Unclaimed" || entry.annotationStatus === "Claimed") && (
              <p className="text-xs text-text-faint">Nothing submitted for QA review yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <LiveStatsPanel project={project} events={events} />
      </div>
    </div>
  );
}
