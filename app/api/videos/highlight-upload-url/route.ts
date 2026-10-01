import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { authorizeProjectVideoAccess } from "@/lib/r2/authorizeProjectVideoAccess";

/** The generated highlight reel (lib/portal/highlightReel.ts) — a single
 * file per project, overwritten on regeneration. Client (owner) or admin
 * only: unlike period cutting, this is initiated from the Results page,
 * not by the annotator doing the tagging. */
export async function POST(request: Request) {
  const { projectId, ext, contentType } = await request.json();
  if (!projectId || !ext) {
    return NextResponse.json({ error: "Missing projectId or ext." }, { status: 400 });
  }

  const auth = await authorizeProjectVideoAccess(projectId, "write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const key = `games/${projectId}/highlights/reel.${ext}`;
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType || "video/mp4",
  });
  const url = await getSignedUrl(createR2Client(), command, { expiresIn: 600 });

  return NextResponse.json({ url, key });
}
