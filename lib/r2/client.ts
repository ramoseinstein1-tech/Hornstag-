import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

/**
 * SERVER-ONLY R2 CLIENT — never import this from a Client Component or
 * anything that ships to the browser; the `server-only` import above
 * makes that a build error rather than a silent credential leak.
 *
 * Cloudflare R2 is S3-API-compatible, so the official AWS SDK works
 * against it unmodified — just point `endpoint` at the account's R2
 * endpoint instead of AWS's.
 */
export function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
