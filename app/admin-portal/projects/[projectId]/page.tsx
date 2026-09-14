"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getProject, type Project } from "@/lib/portal/store";
import { getEvents, pointsForEvent, type AnnotationEvent } from "@/lib/portal/events";
import { getSegments, type VideoSegment } from "@/lib/portal/segments";
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
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [events, setEvents] = useState<AnnotationEvent[]>([]);
  const [segments, setSegments] = useState<VideoSegment[] | null>(null);

  async function refresh() {
    const [p, evts, segs] = await Promise.all([
      getProject(projectId),
      getEvents(projectId),
      getSegments(projectId),
    ]);
    setProject(p);
    setEvents(evts);
    setSegments(segs);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (project === undefined) return null;

  if (!project) {
    return (
      <div className="hs-panel mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-text-muted">This project couldn&rsquo;t be found.</p>
        <Link href="/admin-portal/projects" className="hs-btn-secondary mt-5 inline-flex">
          BACK TO PROJECTS
        </Link>
      </div>
    );
  }

  const taggedTeamScore = events.filter((e) => e.teamSide === "team").reduce((sum, e) => sum + pointsForEvent(e), 0);
  const taggedOpponentScore = events
    .filter((e) => e.teamSide === "opponent")
    .reduce((sum, e) => sum + pointsForEvent(e), 0);
  const teamScoreMatches = project.officialScore ? taggedTeamScore === project.officialScore.team : null;
  const opponentScoreMatches = project.officialScore ? taggedOpponentScore === project.officialScore.opponent : null;

  function handleSeek(seconds: number) {
    videoRef.current?.seekTo(seconds);
  }

  async function handleApprove() {
    await approveAndComplete(projectId);
    await refresh();
  }
  async function handleSendBack() {
    await sendBackToAnnotator(projectId);
    await refresh();
  }
  async function handleReopen() {
    await reopenForReview(projectId);
    await refresh();
  }

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display-md uppercase">
          <span className="text-gradient">{project.name}</span>
        </h1>
        <span className="hs-chip">{project.annotationStatus.toUpperCase()}</span>
      </div>
      <p className="mt-1 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
        OWNER {project.ownerName.toUpperCase()} · {project.format.toUpperCase()}
        {project.claimedByName && ` · ANNOTATED BY ${project.claimedByName.toUpperCase()}`}
        {` · ${events.length} EVENTS`}
        {segments ? " · VIDEO SEGMENTED" : " · VIDEO NOT YET SEGMENTED"}
      </p>

      {project.submissionNote && (
        <div className="hs-panel mt-4 p-4" style={{ borderColor: "var(--border-orange)" }}>
          <p className="mb-1.5 font-mono-tech text-[0.58rem] tracking-[0.14em] text-orange-bright">
            ANNOTATOR NOTE
          </p>
          <p className="text-sm leading-relaxed text-text-muted">{project.submissionNote}</p>
        </div>
      )}

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
            {project.annotationStatus === "In Review" && (
              <div className="flex flex-wrap gap-2.5">
                <button onClick={handleApprove} className="hs-btn-primary">
                  APPROVE &amp; COMPLETE
                </button>
                <button onClick={handleSendBack} className="hs-btn-secondary">
                  SEND BACK TO ANNOTATOR
                </button>
              </div>
            )}
            {project.annotationStatus === "Completed" && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="hs-chip !border-orange/50 !text-orange-bright">COMPLETED — RELAYED TO CLIENT</span>
                <button onClick={handleReopen} className="hs-btn-ghost">
                  REOPEN FOR REVIEW
                </button>
              </div>
            )}
            {(project.annotationStatus === "Unclaimed" || project.annotationStatus === "Claimed") && (
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
