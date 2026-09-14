"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { listAllUsers, type AdminUserSummary } from "@/lib/auth/supabaseAuth";
import { getVisibleProjects, formatRelativeTime, type AnnotationStatus, type Project } from "@/lib/portal/store";
import { getEvents } from "@/lib/portal/events";

function StatTile({ label, value, chips }: { label: string; value: number; chips?: { label: string; value: number }[] }) {
  return (
    <div className="hs-panel hs-panel-hover sheen-top p-6">
      <p className="font-display text-3xl font-semibold tracking-tight text-text">{value}</p>
      <p className="mt-2 font-mono-tech text-[0.62rem] tracking-[0.14em] text-text-faint">{label}</p>
      {chips && chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.label} className="hs-chip !py-1 !text-[0.56rem]">
              {c.value} {c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_ORDER: AnnotationStatus[] = ["Unclaimed", "Claimed", "In Review", "Completed"];

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);

  useEffect(() => {
    listAllUsers().then(setUsers);
    getVisibleProjects().then(async (all) => {
      setProjects(all);
      const counts = await Promise.all(all.map((p) => getEvents(p.id)));
      setTotalEvents(counts.reduce((sum, evts) => sum + evts.length, 0));
    });
  }, []);

  const clients = users.filter((u) => u.role === "client").length;
  const annotators = users.filter((u) => u.role === "annotator").length;
  const admins = users.filter((u) => u.role === "admin").length;

  const recent = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Overview.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Users, projects, and annotation activity across the platform.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="TOTAL USERS"
          value={users.length}
          chips={[
            { label: "CLIENTS", value: clients },
            { label: "ANNOTATORS", value: annotators },
            { label: "ADMINS", value: admins },
          ]}
        />
        <StatTile
          label="TOTAL PROJECTS"
          value={projects.length}
          chips={STATUS_ORDER.map((s) => ({ label: s.toUpperCase(), value: projects.filter((p) => p.annotationStatus === s).length }))}
        />
        <StatTile label="EVENTS TAGGED" value={totalEvents} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 hs-panel sheen-top p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">RECENTLY CREATED PROJECTS</h2>
          <Link href="/admin-portal/projects" className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-orange-bright hover:text-orange">
            VIEW ALL →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-text-faint">No projects yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {recent.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{project.name}</p>
                  <p className="mt-0.5 font-mono-tech text-[0.56rem] tracking-[0.1em] text-text-faint">
                    {project.ownerName} · {formatRelativeTime(project.createdAt).toUpperCase()}
                  </p>
                </div>
                <span className="hs-chip !py-1 !text-[0.56rem]">{project.annotationStatus.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}
