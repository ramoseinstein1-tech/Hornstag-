-- Highlight reels: a single generated "made shots + assists" clip per
-- project, cut and concatenated client-side (lib/portal/highlightReel.ts,
-- same $0 ffmpeg.wasm-in-the-browser approach as period cutting in
-- lib/portal/videoClips.ts) from the already-cut period clips, then
-- uploaded to R2 under games/{projectId}/highlights/. No new RLS policy
-- needed — "clients update own projects" (00000000000020_rls_hardening.sql)
-- already lets the owner write arbitrary columns on their own row, and
-- "admins full access to projects" already covers admin.
alter table public.projects
  add column highlight_reel_path text,
  add column highlight_reel_generated_at timestamptz;
