"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getVisibleProjects, deleteProject, type AnnotationStatus, type Project } from "@/lib/portal/store";
import { unassignAnnotator, rejectProject } from "@/lib/portal/pipeline";
import { getEvents } from "@/lib/portal/events";

type Column = { status: AnnotationStatus; label: string; accent: string };

const COLUMNS: Column[] = [
  { status: "Unclaimed", label: "UNCLAIMED", accent: "text-text-muted" },
  { status: "Claimed", label: "CLAIMED", accent: "text-text-muted" },
  { status: "Correction Required", label: "CORRECTION REQUIRED", accent: "text-[#ff9b9b]" },
  { status: "In Review", label: "IN REVIEW", accent: "text-orange-bright" },
  { status: "Completed", label: "COMPLETED", accent: "text-[#7cd48a]" },
  { status: "Rejected", label: "REJECTED", accent: "text-[#ff9b9b]" },
];

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [rejectTarget, setRejectTarget] = useState<Project | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const all = await getVisibleProjects();
    setProjects(all);
    const entries = await Promise.all(all.map(async (p) => [p.id, (await getEvents(p.id)).length] as const));
    setEventCounts(Object.fromEntries(entries));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleUnassign(project: Project) {
    await unassignAnnotator(project.id);
    await refresh();
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setError(null);
    const result = await rejectProject(rejectTarget.id, rejectReason);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRejectTarget(null);
    setRejectReason("");
    await refresh();
  }

  async function handleDelete() {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return;
    setError(null);
    const result = await deleteProject(deleteTarget.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDeleteTarget(null);
    setDeleteConfirm("");
    await refresh();
  }

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Projects.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Every project across every client, tracked by annotation status.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] px-4 py-3 font-mono-tech text-[0.68rem] leading-relaxed text-[#ff9b9b]">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((col) => {
          const colProjects = projects.filter((p) => p.annotationStatus === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <p className={`font-mono-tech text-[0.6rem] tracking-[0.16em] ${col.accent}`}>{col.label}</p>
                <span className="font-mono-tech text-[0.58rem] text-text-faint">{colProjects.length}</span>
              </div>

              <div className="flex min-h-[120px] flex-col gap-3 rounded-md border border-border bg-surface/40 p-3">
                {colProjects.length === 0 && (
                  <p className="py-6 text-center text-xs text-text-faint">Nothing here.</p>
                )}
                {colProjects.map((project) => (
                  <motion.div
                    key={project.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="hs-panel hs-panel-hover p-4"
                  >
                    <p className="truncate text-sm font-medium text-text">{project.name}</p>
                    <p className="mt-1 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                      OWNER {project.ownerName.toUpperCase()}
                    </p>
                    {project.claimedByName && (
                      <p className="mt-0.5 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                        CLAIMED BY {project.claimedByName.toUpperCase()}
                      </p>
                    )}
                    {col.status === "Rejected" && project.rejectionReason && (
                      <p className="mt-0.5 font-mono-tech text-[0.56rem] tracking-[0.08em] text-[#ff9b9b]">
                        {project.rejectionReason}
                      </p>
                    )}
                    <p className="mt-0.5 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                      {project.roster.length} PLAYERS
                      {project.opponentRoster ? ` · ${project.opponentRoster.length} OPP` : ""}
                      {" · "}
                      {eventCounts[project.id] ?? 0} EVENTS
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin-portal/projects/${project.id}`}
                        className="hs-btn-secondary !px-2.5 !py-1 !text-[0.6rem]"
                      >
                        {project.annotationStatus === "In Review" ? "REVIEW →" : "VIEW →"}
                      </Link>
                      {project.claimedBy &&
                        (project.annotationStatus === "Claimed" || project.annotationStatus === "In Review") && (
                          <button
                            onClick={() => handleUnassign(project)}
                            className="hs-btn-ghost !px-2 !py-1 !text-[0.58rem]"
                          >
                            UNASSIGN
                          </button>
                        )}
                      {col.status !== "Rejected" && col.status !== "Completed" && (
                        <button
                          onClick={() => {
                            setRejectTarget(project);
                            setRejectReason("");
                            setError(null);
                          }}
                          className="font-mono-tech text-[0.58rem] tracking-[0.08em] text-[#ff9b9b] hover:text-[#ff6b6b]"
                        >
                          REJECT
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setDeleteTarget(project);
                          setDeleteConfirm("");
                          setError(null);
                        }}
                        className="ml-auto font-mono-tech text-[0.58rem] tracking-[0.08em] text-text-faint hover:text-[#ff6b6b]"
                      >
                        DELETE
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="hs-panel w-full max-w-md p-6" style={{ borderColor: "rgba(255,107,107,0.25)" }}>
            <h2 className="mb-2 font-mono-tech text-[0.66rem] tracking-[0.2em] text-[#ff9b9b]">REJECT PROJECT</h2>
            <p className="mb-4 text-sm leading-relaxed text-text-muted">
              Mark <span className="text-text">{rejectTarget.name}</span> as unannotatable — the client sees this
              reason on their Results page. This cannot be undone from here.
            </p>
            <textarea
              className="hs-input min-h-[80px] resize-y"
              placeholder="Reason (e.g. corrupted video, wrong game footage, duplicate upload)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setRejectTarget(null)} className="hs-btn-ghost">
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="hs-panel w-full max-w-md p-6" style={{ borderColor: "rgba(255,107,107,0.25)" }}>
            <h2 className="mb-2 font-mono-tech text-[0.66rem] tracking-[0.2em] text-[#ff9b9b]">DELETE PROJECT</h2>
            <p className="mb-4 text-sm leading-relaxed text-text-muted">
              Permanently delete <span className="text-text">{deleteTarget.name}</span> — its roster, tagged events,
              segments, and all uploaded video/clip files. This cannot be undone.
            </p>
            <input
              className="hs-input"
              placeholder={`Type "${deleteTarget.name}" to confirm`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }}
                className="hs-btn-ghost"
              >
                CANCEL
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== deleteTarget.name}
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
