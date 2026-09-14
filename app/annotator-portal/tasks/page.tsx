"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { getVisibleProjects, type AnnotationStatus, type Project } from "@/lib/portal/store";
import { submitForReview } from "@/lib/portal/pipeline";

type Column = { status: AnnotationStatus; label: string; accent: string };

const COLUMNS: Column[] = [
  { status: "Claimed", label: "TO DO", accent: "text-text-muted" },
  { status: "In Review", label: "IN REVIEW", accent: "text-orange-bright" },
  { status: "Completed", label: "COMPLETED", accent: "text-[#7cd48a]" },
];

export default function AnnotatorTasksPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    const all = await getVisibleProjects();
    setProjects(all.filter((p) => p.claimedBy === user.id));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;

  async function handleSubmit(project: Project) {
    await submitForReview(project.id, noteDrafts[project.id]);
    setNoteDrafts((prev) => {
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
    setExpandedNoteId(null);
    await refresh();
  }

  return (
    <div>
      <p className="eyebrow mb-3">ANNOTATOR PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Tasks.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Everything you&rsquo;ve claimed, tracked from first tag to final review.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const colProjects = projects.filter((p) => p.annotationStatus === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <p className={`font-mono-tech text-[0.62rem] tracking-[0.18em] ${col.accent}`}>{col.label}</p>
                <span className="font-mono-tech text-[0.6rem] text-text-faint">{colProjects.length}</span>
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
                      {project.format.toUpperCase()} · {project.roster.length} PLAYERS
                      {project.opponentRoster ? ` · ${project.opponentRoster.length} OPPONENT` : ""}
                    </p>

                    {col.status !== "Claimed" && project.submissionNote && (
                      <p className="mt-2 rounded-md border border-border bg-surface/60 p-2 text-xs leading-relaxed text-text-muted">
                        <span className="font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">YOUR NOTE: </span>
                        {project.submissionNote}
                      </p>
                    )}

                    {col.status === "Claimed" && expandedNoteId === project.id && (
                      <textarea
                        className="hs-input mt-2 min-h-[60px] resize-y !text-xs"
                        placeholder="Notes for QA (optional) — e.g. explain a score discrepancy"
                        value={noteDrafts[project.id] ?? ""}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [project.id]: e.target.value }))
                        }
                      />
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/annotator-portal/matches/${project.id}`}
                        className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-orange-bright hover:text-orange"
                      >
                        OPEN →
                      </Link>
                      {col.status === "Claimed" && (
                        <>
                          {expandedNoteId !== project.id && (
                            <button
                              type="button"
                              onClick={() => setExpandedNoteId(project.id)}
                              className="ml-auto font-mono-tech text-[0.58rem] tracking-[0.08em] text-text-faint hover:text-orange-bright"
                            >
                              + ADD NOTE
                            </button>
                          )}
                          <button
                            onClick={() => handleSubmit(project)}
                            className={`hs-btn-secondary !px-2.5 !py-1 !text-[0.58rem] ${expandedNoteId === project.id ? "ml-auto" : ""}`}
                          >
                            SEND TO REVIEW
                          </button>
                        </>
                      )}
                      {col.status === "In Review" && (
                        <span className="ml-auto font-mono-tech text-[0.58rem] tracking-[0.08em] text-text-faint">
                          AWAITING QA REVIEW
                        </span>
                      )}
                      {col.status === "Completed" && (
                        <span className="ml-auto font-mono-tech text-[0.58rem] tracking-[0.08em] text-[#7cd48a]">
                          ✓ QA APPROVED
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
