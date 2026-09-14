/**
 * ANNOTATION PIPELINE COORDINATOR
 * ─────────────────────────────────────────────────────────────────
 * There are two status enums tracking the same 4 conceptual stages:
 * GlobalAnnotationStatus (globalProjects.ts — driven by annotator/admin
 * actions) and Project.status (store.ts — what the CLIENT'S Results page
 * actually gates on). Before this file existed, `Project.status` was set
 * once at creation and never updated again, so the Results page was
 * permanently stuck showing "still processing" for every real project.
 *
 * This module is the ONLY place that should drive a status transition —
 * it keeps both enums in sync and encodes the actual valid state machine
 * (who can move a project from what to what), replacing the raw
 * `setAnnotationStatus(id, anyStatus)` escape hatch that used to let any
 * caller (e.g. the admin board's old status <select>) jump to any status
 * with no gating at all.
 *
 * Lives as its own file rather than inside either store.ts or
 * globalProjects.ts because store.ts already imports FROM globalProjects
 * (publishProjectToGlobalIndex) — a reverse import to call a status setter
 * would create a cycle. A coordinator that imports one-way from both
 * leaves avoids that while keeping each leaf module single-purpose.
 */

import {
  claimProject as claimGlobalProject,
  unclaimProject as unclaimGlobalProject,
  setAnnotationStatus,
  type GlobalAnnotationStatus,
  type GlobalProjectEntry,
} from "./globalProjects";
import { setProjectStatus, getProjects, addActivity, type ProjectStatus } from "./store";

const STATUS_MAP: Record<GlobalAnnotationStatus, ProjectStatus> = {
  Unclaimed: "Processing",
  Claimed: "In Progress",
  "In Review": "Needs Review",
  Completed: "Completed",
};

const PROGRESS_MAP: Record<ProjectStatus, number> = {
  Processing: 4,
  "In Progress": 50,
  "Needs Review": 90,
  Completed: 100,
};

function transition(ownerId: string, projectId: string, next: GlobalAnnotationStatus): void {
  setAnnotationStatus(projectId, next);
  const status = STATUS_MAP[next];
  setProjectStatus(ownerId, projectId, status, PROGRESS_MAP[status]);
}

/** Annotator: claim an Unclaimed match. */
export function claimForAnnotation(
  ownerId: string,
  projectId: string,
  annotator: { id: string; name: string }
): { ok: true; entry: GlobalProjectEntry } | { ok: false; error: string } {
  const result = claimGlobalProject(projectId, annotator);
  if (result.ok) {
    const status = STATUS_MAP.Claimed;
    setProjectStatus(ownerId, projectId, status, PROGRESS_MAP[status]);
  }
  return result;
}

/** Annotator: Claimed -> In Review ("Submit for Review"). Submission is a
 * one-way door from the annotator's side — only an admin can move it from
 * here (approve, or send back), matching the QA-owns-completion model. */
export function submitForReview(ownerId: string, projectId: string): void {
  transition(ownerId, projectId, "In Review");
}

/** Admin only: In Review -> Completed. This is the moment real annotated
 * results become visible on the client's Results page — and the moment
 * the homepage's promised "reports, dashboards and decisions" deliverable
 * actually needs to land on the client's end, not just theoretically be
 * available if they happen to check. Pushing an activity entry is what
 * makes that concrete and visible on their dashboard. */
export function approveAndComplete(ownerId: string, projectId: string): void {
  transition(ownerId, projectId, "Completed");
  const project = getProjects(ownerId).find((p) => p.id === projectId);
  if (project) {
    addActivity(ownerId, `QA approved — results for "${project.name}" are ready to view.`);
  }
}

/** Admin only: In Review -> Claimed (QA rejection, sent back for fixes). */
export function sendBackToAnnotator(ownerId: string, projectId: string): void {
  transition(ownerId, projectId, "Claimed");
}

/** Admin only: Completed -> In Review (reopen a signed-off project). */
export function reopenForReview(ownerId: string, projectId: string): void {
  transition(ownerId, projectId, "In Review");
}

/** Admin moderation: unassign the annotator from a stuck Claimed/In Review
 * project, returning it to Unclaimed. Not offered for Completed rows by
 * the UI — see app/admin-portal/projects. */
export function unassignAnnotator(ownerId: string, projectId: string): void {
  unclaimGlobalProject(projectId);
  const status = STATUS_MAP.Unclaimed;
  setProjectStatus(ownerId, projectId, status, PROGRESS_MAP[status]);
}
