"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { getProjects, formatRelativeTime, type Project } from "@/lib/portal/store";
import { getGlobalProjects, type GlobalProjectEntry } from "@/lib/portal/globalProjects";
import { claimForAnnotation } from "@/lib/portal/pipeline";

type Row = { entry: GlobalProjectEntry; project: Project | undefined };

export default function AnnotatorMatchesPage() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const rows: Row[] = useMemo(() => {
    const entries = getGlobalProjects().filter((e) => e.annotationStatus === "Unclaimed");
    return entries.map((entry) => ({
      entry,
      project: getProjects(entry.ownerId).find((p) => p.id === entry.projectId),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (!user) return null;

  function handleClaim(row: Row) {
    if (!user) return;
    setClaimingId(row.entry.projectId);
    const result = claimForAnnotation(row.entry.ownerId, row.entry.projectId, { id: user.id, name: user.name });
    if (result.ok) setRefreshKey((k) => k + 1);
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
        Only matches uploaded from this same browser are visible here.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {rows.length === 0 && (
          <div className="hs-panel p-10 text-center">
            <p className="text-sm text-text-muted">No unclaimed matches right now.</p>
            <p className="mt-1 text-xs text-text-faint">Check back once a client uploads new film.</p>
          </div>
        )}
        {rows.map((row, i) => (
          <motion.div
            key={row.entry.projectId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
            className="hs-panel hs-panel-hover flex flex-wrap items-center justify-between gap-4 p-5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">
                {row.project?.name ?? "Untitled match"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {row.project && (
                  <>
                    <span className="hs-chip !py-1 !text-[0.58rem]">{row.project.scope.toUpperCase()}</span>
                    <span className="hs-chip !py-1 !text-[0.58rem]">{row.project.format.toUpperCase()}</span>
                  </>
                )}
                <span className="font-mono-tech text-[0.58rem] tracking-[0.08em] text-text-faint">
                  UPLOADED {formatRelativeTime(row.entry.createdAt).toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleClaim(row)}
              disabled={claimingId === row.entry.projectId}
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
