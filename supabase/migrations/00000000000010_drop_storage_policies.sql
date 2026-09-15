-- Video storage moved to Cloudflare R2 (see lib/r2/client.ts and
-- app/api/videos/*) — Supabase Storage is no longer used for video at
-- all. projects.video_path and video_segments.clip_path keep their
-- columns unchanged, just holding R2 object keys now instead of
-- Supabase Storage paths.

-- Policies dropped, not the bucket itself — with no policies left and
-- RLS enabled (Supabase's default), the bucket is already inert to
-- everyone but the service role. Leaving it in place avoids a
-- destructive delete over whatever test objects it still holds.
drop policy if exists "project videos: upload by owner or admin" on storage.objects;
drop policy if exists "project videos: update by owner or admin" on storage.objects;
drop policy if exists "project videos: read by owner, annotator, or admin" on storage.objects;
drop function if exists public.can_access_project_video(text, boolean);
