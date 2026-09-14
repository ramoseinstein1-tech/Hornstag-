"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getVisibleProjects, type AnnotationStatus, type Project } from "@/lib/portal/store";
import { unassignAnnotator } from "@/lib/portal/pipeline";
import { getEvents } from "@/lib/portal/events";

type Column = { status: AnnotationStatus; label: string; accent: string };

const COLUMNS: Column[] = [
  { status: "Unclaimed", label: "UNCLAIMED", accent: "text-text-muted" },
  { status: "Claimed", label: "CLAIMED", accent: "text-text-muted" },
  { status: "In Review", label: "IN REVIEW", accent: "text-orange-bright" },
  { status: "Completed", label: "COMPLETED", accent: "text-[#7cd48a]" },
];

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});

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

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Projects.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Every project across every client, tracked by annotation status.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-4">
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
