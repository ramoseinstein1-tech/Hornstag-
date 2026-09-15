import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { authorizeProjectVideoAccess } from "@/lib/r2/authorizeProjectVideoAccess";

/** A single cut per-period clip (lib/portal/videoClips.ts). Owner, the
 * assigned annotator (the one actually doing the cutting), or admin. */
export async function POST(request: Request) {
  const { projectId, label, ext, contentType } = await request.json();
  if (!projectId || !label || !ext) {
    return NextResponse.json({ error: "Missing projectId, label, or ext." }, { status: 400 });
  }

  // Annotators need write access here too (they're the ones cutting),
  // unlike the original upload which is client/admin only — so this
  // checks with mode "read", which already includes the assigned
  // annotator, rather than "write".
  const auth = await authorizeProjectVideoAccess(projectId, "read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const key = `games/${projectId}/segments/${label}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType || "video/mp4",
  });
  const url = await getSignedUrl(createR2Client(), command, { expiresIn: 600 });

  return NextResponse.json({ url, key });
}
