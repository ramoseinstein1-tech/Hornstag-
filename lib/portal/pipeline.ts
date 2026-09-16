/**
 * ANNOTATION PIPELINE COORDINATOR
 * ─────────────────────────────────────────────────────────────────
 * Every status transition (claim / submit / approve / send back / reopen /
 * unassign) is now a single Postgres `security definer` RPC (see
 * supabase/migrations/00000000000000_init.sql) that atomically updates
 * both `projects.status` and `projects.annotation_status` together and
 * checks caller role + current status against the valid-transition
 * allow-list server-side. That's what used to require this file to
 * juggle two separate localStorage stores (globalProjects.ts +
 * store.ts) and a STATUS_MAP/PROGRESS_MAP translation table — none of
 * that exists anymore, so this file is just thin async wrappers.
 *
 * Every function below derives the caller's identity from the Supabase
 * session server-side (`auth.uid()`) rather than taking an `ownerId`/
 * `annotator` argument — the RPCs simply reject the call if the caller
 * isn't allowed to make that transition.
 */

import { createClient } from "@/lib/supabase/client";

type RpcResult = { ok: true } | { ok: false; error: string };

async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  if (data === false) return { ok: false, error: "That action isn't allowed right now." };
  return { ok: true };
}

/** Annotator: claim an Unclaimed match. */
export function claimForAnnotation(projectId: string): Promise<RpcResult> {
  return callRpc("claim_for_annotation", { target_project_id: projectId });
}

/** Annotator: Claimed -> In Review ("Submit for Review"). Submission is a
 * one-way door from the annotator's side — only an admin can move it from
 * here (approve, or send back), matching the QA-owns-completion model.
 * `note` is optional free text the annotator can leave for QA — e.g. to
 * explain a score discrepancy — shown on the admin review page. */
export function submitForReview(projectId: string, note?: string): Promise<RpcResult> {
  return callRpc("submit_for_review", { target_project_id: projectId, note: note ?? null });
}

/** Admin only: In Review -> Completed. This is the moment real annotated
 * results become visible on the client's Results page — the RPC itself
 * pushes the client's activity-feed entry server-side. */
export function approveAndComplete(projectId: string): Promise<RpcResult> {
  return callRpc("approve_and_complete", { target_project_id: projectId });
}

/** Admin only: In Review -> Claimed (QA rejection, sent back for fixes). */
export function sendBackToAnnotator(projectId: string): Promise<RpcResult> {
  return callRpc("send_back_to_annotator", { target_project_id: projectId });
}

/** Admin only: Completed -> In Review (reopen a signed-off project). */
export function reopenForReview(projectId: string): Promise<RpcResult> {
  return callRpc("reopen_for_review", { target_project_id: projectId });
}

/** Admin moderation: unassign the annotator from a stuck Claimed/In Review
 * project, returning it to Unclaimed. Not offered for Completed rows by
 * the UI — see app/admin-portal/projects. */
export function unassignAnnotator(projectId: string): Promise<RpcResult> {
  return callRpc("unassign_annotator", { target_project_id: projectId });
}

/** Admin override: reject a project that's fundamentally unannotatable
 * (corrupt video, wrong sport, duplicate upload, etc.) — callable at
 * ANY current status, unlike the transitions above, since this isn't a
 * normal pipeline step. */
export function rejectProject(projectId: string, reason: string): Promise<RpcResult> {
  return callRpc("reject_project", { target_project_id: projectId, reason });
}
