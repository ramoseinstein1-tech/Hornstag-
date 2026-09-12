"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

const STATS = [
  { label: "ACTIVE PROJECTS", value: "3" },
  { label: "EVENTS ANNOTATED THIS MONTH", value: "1,284" },
  { label: "AVG. QA CONFIDENCE", value: "98.2%" },
  { label: "PENDING REVIEW", value: "1" },
];

const PROJECTS = [
  {
    id: "p1",
    name: "Hawks vs. Celtics — Full Game",
    status: "In Progress",
    progress: 62,
    updated: "2 hours ago",
  },
  {
    id: "p2",
    name: "U18 Regional Semifinal",
    status: "Needs Review",
    progress: 100,
    updated: "Yesterday",
  },
  {
    id: "p3",
    name: "Scouting Reel — G. Martinez",
    status: "Completed",
    progress: 100,
    updated: "3 days ago",
  },
];

const ACTIVITY = [
  { id: "a1", text: 'QA pass completed on "Hawks vs. Celtics"', time: "2 hours ago" },
  { id: "a2", text: '42 new events annotated in "U18 Regional Semifinal"', time: "5 hours ago" },
  { id: "a3", text: '"Scouting Reel — G. Martinez" marked complete', time: "3 days ago" },
  { id: "a4", text: 'Uploaded new game film: "Hawks vs. Celtics"', time: "4 days ago" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "In Progress": "border-orange/40 bg-orange/10 text-orange-bright",
    "Needs Review": "border-border-strong bg-surface-light text-text-soft",
    Completed: "border-border bg-transparent text-text-faint",
  };

  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tech text-[0.6rem] tracking-[0.12em] ${styles[status] ?? ""}`}
    >
      {status === "In Progress" && (
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-orange" />
      )}
      {status.toUpperCase()}
    </span>
  );
}

export default function ClientPortalDashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";

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
        {STATS.map((s) => (
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

          <div className="flex flex-col divide-y divide-border">
            {PROJECTS.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">
                    {p.name}
                  </p>
                  <p className="mt-1 font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                    UPDATED {p.updated.toUpperCase()}
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
        </div>

        <div className="hs-panel sheen-top p-6">
          <h2 className="mb-5 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
            RECENT ACTIVITY
          </h2>
          <ul className="flex flex-col gap-4">
            {ACTIVITY.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-orange" />
                <div>
                  <p className="text-sm leading-snug text-text-muted">{a.text}</p>
                  <p className="mt-1 font-mono-tech text-[0.58rem] tracking-[0.12em] text-text-faint">
                    {a.time.toUpperCase()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
