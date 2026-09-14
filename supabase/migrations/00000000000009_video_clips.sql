-- Phase 3: real per-period video clips, cut client-side from the source
-- video uploaded in Phase 2. Clips live under the same project-videos
-- bucket, under {project_id}/clips/{label}.{ext} — the existing storage
-- RLS (keyed off the first path segment being the project id, see
-- can_access_project_video() in 00000000000008_video_storage_fix.sql)
-- already covers this path with no new policy needed.

alter table public.video_segments add column if not exists clip_path text;
