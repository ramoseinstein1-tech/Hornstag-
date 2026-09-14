"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getProjects, getActivity, formatRelativeTime } from "@/lib/portal/store";
import type { ActivityEntry, Project, ProjectStatus } from "@/lib/portal/store";

function StatusBadge({ status }: { status: ProjectStatus }) {
  const styles: Record<ProjectStatus, string> = {
    Processing: "border-orange/40 bg-orange/10 text-orange-bright",
    "In Progress": "border-orange/40 bg-orange/10 text-orange-bright",
    "Needs Review": "border-border-strong bg-surface-light text-text-soft",
    Completed: "border-border bg-transparent text-text-faint",
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

export default function ClientPortalDashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";

  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    getProjects(user.id).then(setProjects);
    getActivity(user.id).then(setActivity);
  }, [user]);

  const activeCount = projects.filter(
    (p) => p.status === "Processing" || p.status === "In Progress"
  ).length;
  const pendingReview = projects.filter((p) => p.status === "Needs Review").length;

  const stats = [
    { label: "ACTIVE PROJECTS", value: String(activeCount) },
    { label: "TOTAL PROJECTS", value: String(projects.length) },
    { label: "AVG. QA CONFIDENCE", value: "98.2%" },
    { label: "PENDING REVIEW", value: String(pendingReview) },
  ];

  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">DASHBOARD</p>
          <h1 className="display-md uppercase">
            <span className="text-gradient">Welcome back, </span>
            <span className="text-gradient-orange">{firstName}.</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Here&rsquo;s what&rsquo;s happening across your projects.
          </p>
        </div>

        <Link href="/client-portal/upload" className="hs-btn-primary">
          CREATE NEW PROJECT
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="hs-panel sheen-top p-5">
            <div className="font-display text-2xl font-semibold text-text">
              {s.value}
            </div>
            <div className="mt-1.5 font-mono-tech text-[0.6rem] tracking-[0.14em] text-text-faint">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="hs-panel sheen-top p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
              ACTIVE PROJECTS
            </h2>
            <Link
              href="/client-portal/projects"
              className="font-mono-tech text-[0.62rem] tracking-[0.14em] text-text-faint transition-colors hover:text-orange-bright"
            >
              VIEW ALL
            </Link>
          </div>

          {projects.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-12 text-center"
            >
              <p className="text-sm text-text-muted">No projects yet.</p>
              <Link
                href="/client-portal/upload"
                className="font-mono-tech text-[0.66rem] tracking-[0.14em] text-orange-bright transition-colors hover:text-orange"
              >
                UPLOAD YOUR FIRST GAME FILM →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {projects.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">
                      {p.name}
                    </p>
                    <p className="mt-1 font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                      UPDATED {formatRelativeTime(p.updatedAt).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-4">
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-light">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p.progress}%`, background: "var(--grad-orange)" }}
                      />
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hs-panel sheen-top p-6">
          <h2 className="mb-5 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
            RECENT ACTIVITY
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-text-faint">Nothing here yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {activity.slice(0, 6).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-orange" />
                  <div>
                    <p className="text-sm leading-snug text-text-muted">{a.text}</p>
                    <p className="mt-1 font-mono-tech text-[0.58rem] tracking-[0.12em] text-text-faint">
                      {formatRelativeTime(a.time).toUpperCase()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
