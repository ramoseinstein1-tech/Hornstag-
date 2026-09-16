-- Once every period of a project has a real cut clip, the full raw
-- source video in R2 is redundant weight against the 10GB free tier —
-- approve_and_complete's client-side wrapper (lib/portal/pipeline.ts)
-- deletes it and records that here, distinct from a project that simply
-- never had a real upload (video_path also null in that case, but
-- video_cleared stays false so the UI doesn't conflate the two).
alter table public.projects
  add column video_cleared boolean not null default false;
