"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProject, getProjectVideoUrl, deleteProject, updateScoreCheckNote, getAuditLog, type Project, type AuditLogEntry } from "@/lib/portal/store";
import { getEvents, pointsForEvent, type AnnotationEvent } from "@/lib/portal/events";
import { getSegments, type VideoSegment } from "@/lib/portal/segments";
import { getVideoIssues, type VideoIssue } from "@/lib/portal/videoIssues";
import { approveAndComplete, sendBackToAnnotator, reopenForReview, rejectProject } from "@/lib/portal/pipeline";
import VideoPlayer, { type VideoPlayerHandle } from "@/components/annotator-portal/VideoPlayer";
import EventsTimeline from "@/components/annotator-portal/EventsTimeline";
import EventsList from "@/components/annotator-portal/EventsList";
import LiveStatsPanel from "@/components/annotator-portal/LiveStatsPanel";
import VideoIssuesPanel from "@/components/annotator-portal/VideoIssuesPanel";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AdminProjectReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<VideoPlayerHandle>(null);
  const [duration, setDuration] = useState(0);
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [events, setEvents] = useState<AnnotationEvent[]>([]);
  const [segments, setSegments] = useState<VideoSegment[] | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [scoreNoteInput, setScoreNoteInput] = useState("");
  const [scoreNoteSaved, setScoreNoteSaved] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [videoIssues, setVideoIssues] = useState<VideoIssue[]>([]);

  async function refresh() {
    const [p, evts, segs, audit, issues] = await Promise.all([
      getProject(projectId),
      getEvents(projectId),
      getSegments(projectId),
      getAuditLog(projectId),
      getVideoIssues(projectId),
    ]);
    setProject(p);
    setEvents(evts);
    setSegments(segs);
    setScoreNoteInput(p?.scoreCheckNote ?? "");
    setAuditLog(audit);
    setVideoIssues(issues);
    if (p) setVideoUrl(await getProjectVideoUrl(p));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleSaveScoreNote() {
    await updateScoreCheckNote(projectId, scoreNoteInput);
    setScoreNoteSaved(true);
    setTimeout(() => setScoreNoteSaved(false), 2500);
  }

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

  async function handleReject() {
    setActionError(null);
    const result = await rejectProject(projectId, rejectReason);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setShowReject(false);
    setRejectReason("");
    await refresh();
  }

  async function handleDelete() {
    if (deleteConfirm !== project!.name) return;
    setActionError(null);
    const result = await deleteProject(projectId);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    router.push("/admin-portal/projects");
  }

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display-md uppercase">
          <span className="text-gradient">{project.name}</span>
        </h1>
        <div className="flex flex-none items-center gap-3">
          <span className="hs-chip">{project.annotationStatus.toUpperCase()}</span>
          {project.annotationStatus !== "Rejected" && project.annotationStatus !== "Completed" && (
            <button
              onClick={() => {
                setShowReject(true);
                setRejectReason("");
                setActionError(null);
              }}
              className="font-mono-tech text-[0.6rem] tracking-[0.08em] text-[#ff9b9b] hover:text-[#ff6b6b]"
            >
              REJECT
            </button>
          )}
          <button
            onClick={() => {
              setShowDelete(true);
              setDeleteConfirm("");
              setActionError(null);
            }}
            className="font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint hover:text-[#ff6b6b]"
          >
            DELETE
          </button>
        </div>
      </div>
      <p className="mt-1 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
        OWNER {project.ownerName.toUpperCase()} · {project.format.toUpperCase()}
        {project.claimedByName && ` · ANNOTATED BY ${project.claimedByName.toUpperCase()}`}
        {` · ${events.length} EVENTS`}
        {segments ? " · VIDEO SEGMENTED" : " · VIDEO NOT YET SEGMENTED"}
      </p>

      {actionError && (
        <div className="mt-4 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] px-4 py-3 font-mono-tech text-[0.68rem] leading-relaxed text-[#ff9b9b]">
          {actionError}
        </div>
      )}

      {project.annotationStatus === "Rejected" && project.rejectionReason && (
        <div className="hs-panel mt-4 p-4" style={{ borderColor: "rgba(255,107,107,0.3)" }}>
          <p className="mb-1.5 font-mono-tech text-[0.58rem] tracking-[0.14em] text-[#ff9b9b]">REJECTION REASON</p>
          <p className="text-sm leading-relaxed text-text-muted">{project.rejectionReason}</p>
        </div>
      )}

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
          {videoUrl ? (
            <VideoPlayer ref={videoRef} src={videoUrl} onDurationChange={setDuration} />
          ) : (
            <div className="hs-panel flex aspect-video items-center justify-center text-sm text-text-faint">
              Loading video…
            </div>
          )}
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

              {(!teamScoreMatches || (project.scope === "Both Teams" && !opponentScoreMatches)) && (
                <div className="mt-4 border-t border-border pt-4">
                  <label htmlFor="score-note" className="hs-label">
                    NOTE EXPLAINING THE MISMATCH (SHOWN TO CLIENT)
                  </label>
                  <textarea
                    id="score-note"
                    className="hs-input min-h-[70px] resize-y"
                    placeholder="e.g. Annotator confirmed the scoreboard was correct — likely a missed free throw in tagging."
                    value={scoreNoteInput}
                    onChange={(e) => setScoreNoteInput(e.target.value)}
                  />
                  <button onClick={handleSaveScoreNote} className="hs-btn-secondary mt-2 !px-3 !py-1.5 !text-[0.6rem]">
                    {scoreNoteSaved ? "SAVED ✓" : "SAVE NOTE"}
                  </button>
                </div>
              )}
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
            {(project.annotationStatus === "Unclaimed" ||
              project.annotationStatus === "Claimed" ||
              project.annotationStatus === "Correction Required") && (
              <p className="text-xs text-text-faint">
                {project.annotationStatus === "Correction Required"
                  ? "Sent back to the annotator — waiting on a resubmission."
                  : "Nothing submitted for QA review yet."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <LiveStatsPanel project={project} events={events} />
      </div>

      {user && (
        <div className="mt-8">
          <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">VIDEO ISSUES</p>
          <VideoIssuesPanel
            projectId={projectId}
            issues={videoIssues}
            currentTimeSeconds={duration ? videoRef.current?.getCurrentTime?.() : undefined}
            reporterName={user.name}
            reporterRole={user.role}
            currentUserId={user.id}
            isAdmin
            onChange={async () => setVideoIssues(await getVideoIssues(projectId))}
          />
        </div>
      )}

      {auditLog.length > 0 && (
        <div className="mt-8 hs-panel p-5">
          <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">AUDIT LOG</p>
          <ul className="flex flex-col divide-y divide-border">
            {auditLog.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
                <p className="text-sm text-text-muted">{entry.summary}</p>
                <p className="font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                  {entry.actorRole.toUpperCase()} · {new Date(entry.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="hs-panel w-full max-w-md p-6" style={{ borderColor: "rgba(255,107,107,0.25)" }}>
            <h2 className="mb-2 font-mono-tech text-[0.66rem] tracking-[0.2em] text-[#ff9b9b]">REJECT PROJECT</h2>
            <p className="mb-4 text-sm leading-relaxed text-text-muted">
              Mark <span className="text-text">{project.name}</span> as unannotatable — the client sees this reason
              on their Results page. This cannot be undone from here.
            </p>
            <textarea
              className="hs-input min-h-[80px] resize-y"
              placeholder="Reason (e.g. corrupted video, wrong game footage, duplicate upload)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowReject(false)} className="hs-btn-ghost">
                CANCEL
              </button>
              <button
                onClick={handleReject}
                className="rounded-md border px-4 py-2.5 font-mono-tech text-[0.7rem] tracking-[0.1em] text-[#ff9b9b] transition-colors hover:bg-[#ff6b6b]/10"
                style={{ borderColor: "rgba(255,107,107,0.4)" }}
              >
                REJECT PROJECT
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="hs-panel w-full max-w-md p-6" style={{ borderColor: "rgba(255,107,107,0.25)" }}>
            <h2 className="mb-2 font-mono-tech text-[0.66rem] tracking-[0.2em] text-[#ff9b9b]">DELETE PROJECT</h2>
            <p className="mb-4 text-sm leading-relaxed text-text-muted">
              Permanently delete <span className="text-text">{project.name}</span> — its roster, tagged events,
              segments, and all uploaded video/clip files. This cannot be undone.
            </p>
            <input
              className="hs-input"
              placeholder={`Type "${project.name}" to confirm`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowDelete(false)} className="hs-btn-ghost">
                CANCEL
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== project.name}
                className="rounded-md border px-4 py-2.5 font-mono-tech text-[0.7rem] tracking-[0.1em] text-[#ff9b9b] transition-colors hover:bg-[#ff6b6b]/10 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: "rgba(255,107,107,0.4)" }}
              >
                PERMANENTLY DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
