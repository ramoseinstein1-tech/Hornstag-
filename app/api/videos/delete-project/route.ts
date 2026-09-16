import { NextResponse } from "next/server";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createR2Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin-only: permanently deletes a project — its R2 video/clip files
 * plus the Postgres row (which cascades to roster_players,
 * annotation_events, and video_segments via their existing foreign
 * keys). R2 cleanup is best-effort: if it fails, the Postgres delete
 * still proceeds. An orphaned R2 object is a minor, recoverable cost;
 * a project that can never be removed is worse for a page whose whole
 * point right now is clearing out test clutter.
 */
export async function POST(request: Request) {
  const { projectId } = await request.json();
  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", caller.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const r2 = createR2Client();
  try {
    const prefix = `games/${projectId}/`;
    let continuationToken: string | undefined;
    do {
      const listed = await r2.send(
        new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: prefix, ContinuationToken: continuationToken })
      );
      const objects = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key);
      if (objects.length > 0) {
        await r2.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET_NAME, Delete: { Objects: objects } }));
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (err) {
    console.error(`Failed to clean up R2 files for project ${projectId}:`, err);
  }

  // The caller is already confirmed admin above, and the "admins full
  // access to projects" RLS policy permits this delete directly — no
  // need for a service-role bypass here.
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
