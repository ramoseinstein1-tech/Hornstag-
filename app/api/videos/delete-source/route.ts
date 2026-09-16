import { NextResponse } from "next/server";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createR2Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin-only: deletes just a project's raw uploaded source video —
 * not its cut period clips (games/{projectId}/segments/), which are
 * what everything downstream actually plays. Called once from
 * lib/portal/pipeline.ts's approveAndComplete, only after confirming
 * every period already has a real clip, so this never strands a
 * project's only copy of unfinished footage. Best-effort R2 delete,
 * same tolerance as app/api/videos/delete-project/route.ts — but
 * unlike that route, the caller only flips video_cleared/nulls
 * video_path in Postgres once this delete actually succeeds, since an
 * orphaned R2 object is recoverable but a false "cleared" record with
 * the file still present is not.
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
    const prefix = `games/${projectId}/original/`;
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to delete source video for project ${projectId}:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
