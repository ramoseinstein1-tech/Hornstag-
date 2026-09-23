"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { getVisibleProjects, formatRelativeTime, type Project } from "@/lib/portal/store";
import { claimForAnnotation } from "@/lib/portal/pipeline";

export default function AnnotatorMatchesPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    getVisibleProjects().then((all) =>
      setProjects(all.filter((p) => p.annotationStatus === "Unclaimed"))
    );
  }, []);

  if (!user) return null;

  async function handleClaim(project: Project) {
    setClaimingId(project.id);
    const result = await claimForAnnotation(project.id);
    if (result.ok) {
      const all = await getVisibleProjects();
      setProjects(all.filter((p) => p.annotationStatus === "Unclaimed"));
    }
    setClaimingId(null);
  }

  return (
    <div>
      <p className="eyebrow mb-3">ANNOTATOR PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Matches.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Unclaimed matches ready to tag. Claim one to move it to your Tasks board.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {projects.length === 0 && (
          <div className="hs-panel p-10 text-center">
            <p className="text-sm text-text-muted">No unclaimed matches right now.</p>
            <p className="mt-1 text-xs text-text-faint">Check back once a client uploads new film.</p>
          </div>
        )}
        {projects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
            className="hs-panel hs-panel-hover flex flex-wrap items-center justify-between gap-4 p-5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{project.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {project.annotationKind === "heart_stats" && (
                  <span className="hs-chip !py-1 !text-[0.58rem] !border-[#ff6b6b]/40 !text-[#ff9b9b]">
                    HEART STATS
                  </span>
                )}
                <span className="hs-chip !py-1 !text-[0.58rem]">{project.scope.toUpperCase()}</span>
                <span className="hs-chip !py-1 !text-[0.58rem]">{project.format.toUpperCase()}</span>
                <span className="font-mono-tech text-[0.58rem] tracking-[0.08em] text-text-faint">
                  UPLOADED {formatRelativeTime(project.createdAt).toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleClaim(project)}
              disabled={claimingId === project.id}
              className="hs-btn-primary flex-none disabled:cursor-wait disabled:opacity-70"
            >
              CLAIM MATCH
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
