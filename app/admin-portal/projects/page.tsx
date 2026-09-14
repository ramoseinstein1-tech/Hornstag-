"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getProjects, type Project } from "@/lib/portal/store";
import {
  getGlobalProjects,
  type GlobalAnnotationStatus,
  type GlobalProjectEntry,
} from "@/lib/portal/globalProjects";
import { unassignAnnotator } from "@/lib/portal/pipeline";
import { getEvents } from "@/lib/portal/events";

type Row = { entry: GlobalProjectEntry; project: Project | undefined };

type Column = { status: GlobalAnnotationStatus; label: string; accent: string };

const COLUMNS: Column[] = [
  { status: "Unclaimed", label: "UNCLAIMED", accent: "text-text-muted" },
  { status: "Claimed", label: "CLAIMED", accent: "text-text-muted" },
  { status: "In Review", label: "IN REVIEW", accent: "text-orange-bright" },
  { status: "Completed", label: "COMPLETED", accent: "text-[#7cd48a]" },
];

export default function AdminProjectsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const rows: Row[] = useMemo(
    () =>
      getGlobalProjects().map((entry) => ({
        entry,
        project: getProjects(entry.ownerId).find((p) => p.id === entry.projectId),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey]
  );

  function handleUnassign(row: Row) {
    unassignAnnotator(row.entry.ownerId, row.entry.projectId);
    setRefreshKey((k) => k + 1);
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
          const colRows = rows.filter((r) => r.entry.annotationStatus === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <p className={`font-mono-tech text-[0.6rem] tracking-[0.16em] ${col.accent}`}>{col.label}</p>
                <span className="font-mono-tech text-[0.58rem] text-text-faint">{colRows.length}</span>
              </div>

              <div className="flex min-h-[120px] flex-col gap-3 rounded-md border border-border bg-surface/40 p-3">
                {colRows.length === 0 && (
                  <p className="py-6 text-center text-xs text-text-faint">Nothing here.</p>
                )}
                {colRows.map((row) => (
                  <motion.div
                    key={row.entry.projectId}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="hs-panel hs-panel-hover p-4"
                  >
                    <p className="truncate text-sm font-medium text-text">
                      {row.project?.name ?? "Untitled match"}
                    </p>
                    <p className="mt-1 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                      OWNER {row.entry.ownerName.toUpperCase()}
                    </p>
                    {row.entry.claimedBy && (
                      <p className="mt-0.5 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                        CLAIMED BY {row.entry.claimedBy.annotatorName.toUpperCase()}
                      </p>
                    )}
                    {row.project && (
                      <p className="mt-0.5 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                        {row.project.roster.length} PLAYERS
                        {row.project.opponentRoster ? ` · ${row.project.opponentRoster.length} OPP` : ""}
                        {" · "}
                        {getEvents(row.entry.projectId).length} EVENTS
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin-portal/projects/${row.entry.projectId}`}
                        className="hs-btn-secondary !px-2.5 !py-1 !text-[0.6rem]"
                      >
                        {row.entry.annotationStatus === "In Review" ? "REVIEW →" : "VIEW →"}
                      </Link>
                      {row.entry.claimedBy &&
                        (row.entry.annotationStatus === "Claimed" || row.entry.annotationStatus === "In Review") && (
                          <button
                            onClick={() => handleUnassign(row)}
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
