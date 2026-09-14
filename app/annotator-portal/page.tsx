"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { getVisibleProjects } from "@/lib/portal/store";
import type { Project } from "@/lib/portal/store";
import { getEvents } from "@/lib/portal/events";

function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="hs-panel hs-panel-hover sheen-top p-6">
      <p className={`font-display text-3xl font-semibold tracking-tight ${accent ? "text-orange-bright" : "text-text"}`}>
        {value}
      </p>
      <p className="mt-2 font-mono-tech text-[0.62rem] tracking-[0.14em] text-text-faint">{label}</p>
    </div>
  );
}

export default function AnnotatorDashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [eventsTagged, setEventsTagged] = useState(0);

  useEffect(() => {
    if (!user) return;
    getVisibleProjects().then(async (all) => {
      setProjects(all);
      const claimedByMe = all.filter((p) => p.claimedBy === user.id);
      const counts = await Promise.all(claimedByMe.map((p) => getEvents(p.id)));
      setEventsTagged(counts.reduce((sum, evts) => sum + evts.length, 0));
    });
  }, [user]);

  if (!user) return null;

  const unclaimed = projects.filter((p) => p.annotationStatus === "Unclaimed");
  const claimedByMe = projects.filter((p) => p.claimedBy === user.id);
  const inProgress = claimedByMe.filter((p) => p.annotationStatus !== "Completed");

  return (
    <div>
      <p className="eyebrow mb-3">ANNOTATOR PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Welcome back, </span>
        <span className="text-gradient-orange">{user.name.split(" ")[0]}.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Matches uploaded by any client show up below, ready to claim and tag.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="UNCLAIMED MATCHES" value={unclaimed.length} />
        <StatTile label="YOUR ACTIVE TASKS" value={inProgress.length} accent />
        <StatTile label="EVENTS TAGGED" value={eventsTagged} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 hs-panel sheen-top p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">YOUR TASKS</h2>
          {claimedByMe.length > 0 && (
            <Link href="/annotator-portal/tasks" className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-orange-bright hover:text-orange">
              VIEW BOARD →
            </Link>
          )}
        </div>
        {claimedByMe.length === 0 ? (
          <p className="text-sm text-text-faint">
            You haven&rsquo;t claimed a match yet.{" "}
            <Link href="/annotator-portal/matches" className="text-orange-bright hover:text-orange">
              Browse matches →
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {claimedByMe.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{project.name}</p>
                  <p className="mt-0.5 font-mono-tech text-[0.56rem] tracking-[0.1em] text-text-faint">
                    {project.annotationStatus.toUpperCase()}
                  </p>
                </div>
                <Link
                  href={`/annotator-portal/matches/${project.id}`}
                  className="flex-none font-mono-tech text-[0.62rem] tracking-[0.1em] text-orange-bright hover:text-orange"
                >
                  OPEN →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}
