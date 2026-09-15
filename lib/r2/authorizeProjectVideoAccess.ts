import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * The single security boundary standing in for what
 * can_access_project_video() (Postgres RLS, supabase/migrations/
 * 00000000000008_video_storage_fix.sql) used to enforce for Supabase
 * Storage — R2 has no equivalent row-level policy engine, so every
 * route that hands out a presigned R2 URL must call this first.
 *
 * `mode: "write"` (uploading original/clip footage) — owner or admin.
 * `mode: "read"` (playback) — owner, the currently assigned annotator,
 * or admin — same three parties who could always see the project row.
 */
export async function authorizeProjectVideoAccess(
  projectId: string,
  mode: "read" | "write"
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { ok: false, status: 401, error: "Not signed in." };

  const [{ data: profile }, { data: project }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", caller.id).single(),
    supabase.from("projects").select("owner_id, claimed_by").eq("id", projectId).single(),
  ]);

  if (!project) return { ok: false, status: 404, error: "Project not found." };
  if (profile?.role === "admin") return { ok: true };
  if (project.owner_id === caller.id) return { ok: true };
  if (mode === "read" && project.claimed_by === caller.id) return { ok: true };

  return { ok: false, status: 403, error: "You don't have access to this project's video." };
}
