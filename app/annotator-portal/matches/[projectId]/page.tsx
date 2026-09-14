"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getProject, type Project } from "@/lib/portal/store";
import { claimForAnnotation } from "@/lib/portal/pipeline";
import AnnotationWorkspace from "@/components/annotator-portal/AnnotationWorkspace";

export default function MatchWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [claiming, setClaiming] = useState(false);

  async function refresh() {
    setProject(await getProject(projectId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!user || project === undefined) return null;

  if (!project) {
    return (
      <div className="hs-panel mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-text-muted">This match couldn&rsquo;t be found.</p>
        <Link href="/annotator-portal/matches" className="hs-btn-secondary mt-5 inline-flex">
          BACK TO MATCHES
        </Link>
      </div>
    );
  }

  const claimedByMe = project.claimedBy === user.id;

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
          {project.annotationStatus === "Unclaimed"
            ? "Claim this match to start annotating."
            : `Already claimed by ${project.claimedByName ?? "another annotator"}.`}
        </p>
        {project.annotationStatus === "Unclaimed" && (
          <button
            onClick={async () => {
              setClaiming(true);
              await claimForAnnotation(projectId);
              await refresh();
              setClaiming(false);
            }}
            disabled={claiming}
            className="hs-btn-primary mt-6 disabled:cursor-wait disabled:opacity-70"
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

  return <AnnotationWorkspace project={project} annotationStatus={project.annotationStatus} />;
}
