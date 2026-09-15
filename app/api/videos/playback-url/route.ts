import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { authorizeProjectVideoAccess } from "@/lib/r2/authorizeProjectVideoAccess";

/** A short-lived signed GET URL for an already-uploaded object — the
 * original source or a cut clip, identified by its stored R2 key
 * (projects.video_path / video_segments.clip_path). Owner, the
 * assigned annotator, or admin. */
export async function POST(request: Request) {
  const { projectId, key } = await request.json();
  if (!projectId || !key) {
    return NextResponse.json({ error: "Missing projectId or key." }, { status: 400 });
  }
  // The key must actually belong to this project — otherwise an
  // authorized caller for project A could pass project B's key and
  // read it under project A's authorization check.
  if (!key.startsWith(`games/${projectId}/`)) {
    return NextResponse.json({ error: "Key does not belong to this project." }, { status: 400 });
  }

  const auth = await authorizeProjectVideoAccess(projectId, "read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  const url = await getSignedUrl(createR2Client(), command, { expiresIn: 3600 });

  return NextResponse.json({ url });
}
