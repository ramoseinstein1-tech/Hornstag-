"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getProjects } from "@/lib/portal/store";
import { getGlobalProjectByProjectId } from "@/lib/portal/globalProjects";
import { claimForAnnotation } from "@/lib/portal/pipeline";
import AnnotationWorkspace from "@/components/annotator-portal/AnnotationWorkspace";

export default function MatchWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { user } = useAuth();
  // Unread on purpose — bumping it just forces a re-render so the fresh
  // claim status (read directly from localStorage below, not memoized) is
  // picked up immediately after claiming.
  const [, setRefreshKey] = useState(0);

  if (!user) return null;

  const entry = getGlobalProjectByProjectId(projectId);
  const project = entry ? getProjects(entry.ownerId).find((p) => p.id === entry.projectId) : undefined;

  if (!entry || !project) {
    return (
      <div className="hs-panel mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-text-muted">This match couldn&rsquo;t be found.</p>
        <Link href="/annotator-portal/matches" className="hs-btn-secondary mt-5 inline-flex">
          BACK TO MATCHES
        </Link>
      </div>
    );
  }

  const claimedByMe = entry.claimedBy?.annotatorId === user.id;

  if (!claimedByMe) {
    return (
      <div className="hs-panel sheen-top mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-text">
          {project.name}
        </h1>
        <p className="mt-2 font-mono-tech text-[0.6rem] tracking-[0.14em] text-orange-bright">
          TRACKED BY {project.format.toUpperCase()}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          {entry.annotationStatus === "Unclaimed"
            ? "Claim this match to start annotating."
            : `Already claimed by ${entry.claimedBy?.annotatorName ?? "another annotator"}.`}
        </p>
        {entry.annotationStatus === "Unclaimed" && (
          <button
            onClick={() => {
              claimForAnnotation(entry.ownerId, projectId, { id: user.id, name: user.name });
              setRefreshKey((k) => k + 1);
            }}
            className="hs-btn-primary mt-6"
          >
            CLAIM TO START ANNOTATING
          </button>
        )}
        <Link
          href="/annotator-portal/matches"
          className="mt-4 block font-mono-tech text-[0.62rem] tracking-[0.14em] text-text-faint hover:text-orange-bright"
        >
          BACK TO MATCHES
        </Link>
      </div>
    );
  }

  return (
    <AnnotationWorkspace
      project={project}
      ownerId={entry.ownerId}
      annotationStatus={entry.annotationStatus}
    />
  );
}
