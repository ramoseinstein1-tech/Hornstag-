import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { authorizeProjectVideoAccess } from "@/lib/r2/authorizeProjectVideoAccess";

// R2's single-PUT ceiling — a real sanity cap rather than the old
// Supabase free-tier 50MB wall this replaces.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

function extensionOf(fileName: string): string {
  return fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "mp4";
}

/** A project's original uploaded game film. Client (owner) or admin only. */
export async function POST(request: Request) {
  const { projectId, fileName, contentType, fileSize } = await request.json();
  if (!projectId || !fileName) {
    return NextResponse.json({ error: "Missing projectId or fileName." }, { status: 400 });
  }
  if (typeof fileSize === "number" && fileSize > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is over the 5GiB upload limit." }, { status: 413 });
  }

  const auth = await authorizeProjectVideoAccess(projectId, "write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const key = `games/${projectId}/original/source.${extensionOf(fileName)}`;
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType || "video/mp4",
  });
  const url = await getSignedUrl(createR2Client(), command, { expiresIn: 600 });

  return NextResponse.json({ url, key });
}
