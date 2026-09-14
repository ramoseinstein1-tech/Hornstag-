-- Phase 2: real per-project video storage. The app has always played a
-- single hardcoded shared sample clip until now — this adds a private
-- bucket, keyed by project id, so each project can hold its own real
-- uploaded footage.
--
-- Free-tier note: Supabase caps individual uploads at 50MB regardless of
-- this bucket's own file_size_limit until the project upgrades to Pro.
-- file_size_limit is set here anyway as defense-in-depth alongside the
-- app's own client-side check, and is the one line to raise later.

alter table public.projects add column if not exists video_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-videos', 'project-videos', false, 52428800, array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project videos: upload by owner or admin" on storage.objects;
drop policy if exists "project videos: update by owner or admin" on storage.objects;
drop policy if exists "project videos: read by owner, annotator, or admin" on storage.objects;

-- Path convention: project-videos/{project_id}/source.{ext} — the first
-- folder segment is the project id, so ownership checks join straight
-- back to the projects table (same pattern used by every RLS policy in
-- 00000000000000_init.sql, just applied to storage.objects instead).

create policy "project videos: upload by owner or admin"
on storage.objects for insert
with check (
  bucket_id = 'project-videos'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and (p.owner_id = auth.uid() or public.current_role() = 'admin')
  )
);

create policy "project videos: update by owner or admin"
on storage.objects for update
using (
  bucket_id = 'project-videos'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and (p.owner_id = auth.uid() or public.current_role() = 'admin')
  )
);

create policy "project videos: read by owner, annotator, or admin"
on storage.objects for select
using (
  bucket_id = 'project-videos'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and (
        p.owner_id = auth.uid()
        or p.claimed_by = auth.uid()
        or public.current_role() = 'admin'
      )
  )
);
