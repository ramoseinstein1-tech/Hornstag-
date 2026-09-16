"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { getProjects, formatRelativeTime } from "@/lib/portal/store";
import type { Project, ProjectStatus, RosterPlayer } from "@/lib/portal/store";

const FILTERS: ("All" | ProjectStatus)[] = [
  "All",
  "Processing",
  "In Progress",
  "Needs Review",
  "Completed",
];

function StatusBadge({ status }: { status: ProjectStatus }) {
  const styles: Record<ProjectStatus, string> = {
    Processing: "border-orange/40 bg-orange/10 text-orange-bright",
    "In Progress": "border-orange/40 bg-orange/10 text-orange-bright",
    "Needs Review": "border-border-strong bg-surface-light text-text-soft",
    Completed: "border-border bg-transparent text-text-faint",
    Rejected: "border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] text-[#ff9b9b]",
  };
  const isActive = status === "Processing" || status === "In Progress";

  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tech text-[0.6rem] tracking-[0.12em] ${styles[status]}`}
    >
      {isActive && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-orange" />}
      {status.toUpperCase()}
    </span>
  );
}

function RosterChips({ roster }: { roster: RosterPlayer[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {roster.map((p, i) => (
        <span
          key={i}
          className="rounded border border-border bg-surface-light px-2 py-1 font-mono-tech text-[0.6rem] text-text-soft"
        >
          #{p.number} {p.name}
        </span>
      ))}
    </div>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="hs-panel sheen-top overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="truncate text-sm font-medium text-text">{project.name}</p>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-1.5 font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
            {project.scope.toUpperCase()} · {project.format.toUpperCase()} · UPDATED{" "}
            {formatRelativeTime(project.updatedAt).toUpperCase()}
          </p>
        </div>

        <div className="flex flex-none items-center gap-4">
          <div className="h-1 w-28 overflow-hidden rounded-full bg-surface-light">
            <div
              className="h-full rounded-full"
              style={{ width: `${project.progress}%`, background: "var(--grad-orange)" }}
            />
          </div>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="text-text-faint"
            aria-hidden="true"
          >
            ⌄
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
              <div className="flex flex-col gap-4">
                {project.opponent && (
                  <div>
                    <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                      OPPONENT
                    </span>
                    <p className="mt-1 text-sm text-text">{project.opponent}</p>
                  </div>
                )}
                {project.gameDate && (
                  <div>
                    <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                      GAME DATE
                    </span>
                    <p className="mt-1 text-sm text-text">{project.gameDate}</p>
                  </div>
                )}
                {project.fileName && (
                  <div>
                    <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                      GAME FILM
                    </span>
                    <p className="mt-1 text-sm text-text">
                      {project.fileName}
                      {project.fileSize ? ` (${project.fileSize})` : ""}
                    </p>
                  </div>
                )}
                {project.notes && (
                  <div>
                    <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                      NOTES
                    </span>
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">
                      {project.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                    {project.scope === "Both Teams" ? "YOUR TEAM ROSTER" : "TEAM ROSTER"}
                  </span>
                  <div className="mt-2">
                    <RosterChips roster={project.roster} />
                  </div>
                </div>
                {project.opponentRoster && project.opponentRoster.length > 0 && (
                  <div>
                    <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                      OPPONENT ROSTER
                    </span>
                    <div className="mt-2">
                      <RosterChips roster={project.opponentRoster} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"All" | ProjectStatus>("All");

  const [allProjects, setAllProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    getProjects(user.id).then(setAllProjects);
  }, [user]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f] = 0;
    c.All = allProjects.length;
    for (const p of allProjects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [allProjects]);

  const filtered = filter === "All" ? allProjects : allProjects.filter((p) => p.status === filter);

  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">CLIENT PORTAL</p>
          <h1 className="display-md uppercase">
            <span className="text-gradient">Your </span>
            <span className="text-gradient-orange">Projects.</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Every game film you&rsquo;ve submitted, with live status and
            roster details.
          </p>
        </div>
        <Link href="/client-portal/upload" className="hs-btn-primary">
          CREATE NEW PROJECT
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-2 font-mono-tech text-[0.62rem] tracking-[0.12em] transition-all duration-300 ${
              filter === f
                ? "border-orange/50 bg-orange/10 text-orange-bright"
                : "border-border bg-transparent text-text-muted hover:border-border-strong"
            }`}
          >
            {f.toUpperCase()} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="hs-panel flex flex-col items-center justify-center gap-3 p-14 text-center">
            <p className="text-sm text-text-muted">
              {allProjects.length === 0
                ? "No projects yet."
                : "No projects match this filter."}
            </p>
            {allProjects.length === 0 && (
              <Link
                href="/client-portal/upload"
                className="font-mono-tech text-[0.66rem] tracking-[0.14em] text-orange-bright transition-colors hover:text-orange"
              >
                UPLOAD YOUR FIRST GAME FILM →
              </Link>
            )}
          </div>
        ) : (
          filtered.map((p) => <ProjectRow key={p.id} project={p} />)
        )}
      </div>
    </div>
  );
}
