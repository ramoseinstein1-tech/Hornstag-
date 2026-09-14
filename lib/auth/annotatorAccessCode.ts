/**
 * Soft signup gate for annotator accounts. Client-side only — like the
 * rest of lib/auth, this is a functional stand-in, not a security
 * boundary. Override via NEXT_PUBLIC_ANNOTATOR_ACCESS_CODE for anything
 * beyond a demo (e.g. before sharing the annotator signup link outside
 * the team).
 */
export const ANNOTATOR_ACCESS_CODE =
  process.env.NEXT_PUBLIC_ANNOTATOR_ACCESS_CODE ?? "HORNSTAG-ANNOTATOR-2026";
