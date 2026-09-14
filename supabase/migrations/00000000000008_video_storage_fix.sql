-- Real fix for Phase 2's storage RLS bug, plus cleanup of every
-- temporary diagnostic artifact from migrations 4-7.
--
-- Root cause: a storage.objects RLS policy that references public.projects
-- via a plain subquery gets blocked — confirmed via a series of isolated
-- diagnostics (a trivial `true` check works once a matching SELECT policy
-- exists; the exact same shape with a `projects` subquery added fails
-- every time, regardless of the subquery's exact wording). The fix is
-- the standard, Supabase-recommended pattern for this: wrap the
-- cross-table check in a `security definer` function, which executes
-- with the function owner's privileges and so isn't subject to whatever
-- is blocking a direct nested lookup against projects' own RLS.

drop policy if exists "DIAG always true" on storage.objects;
drop policy if exists "DIAG select true" on storage.objects;
drop policy if exists "DIAG auth uid only" on storage.objects;
drop policy if exists "DIAG projects join insert" on storage.objects;
drop policy if exists "DIAG projects join select" on storage.objects;
drop function if exists public.debug_storage_check(text);

drop policy if exists "project videos: upload by owner or admin" on storage.objects;
drop policy if exists "project videos: update by owner or admin" on storage.objects;
drop policy if exists "project videos: read by owner, annotator, or admin" on storage.objects;
drop function if exists public.can_access_project_video(text, boolean);

create function public.can_access_project_video(project_id_text text, want_write boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select owner_id, claimed_by into p from public.projects where id::text = project_id_text;
  if not found then
    return false;
  end if;
  if want_write then
    return p.owner_id = auth.uid() or public.current_role() = 'admin';
  end if;
  return p.owner_id = auth.uid() or p.claimed_by = auth.uid() or public.current_role() = 'admin';
end;
$$;

create policy "project videos: upload by owner or admin"
on storage.objects for insert
with check (
  bucket_id = 'project-videos'
  and public.can_access_project_video((storage.foldername(name))[1], true)
);

create policy "project videos: update by owner or admin"
on storage.objects for update
using (
  bucket_id = 'project-videos'
  and public.can_access_project_video((storage.foldername(name))[1], true)
);

create policy "project videos: read by owner, annotator, or admin"
on storage.objects for select
using (
  bucket_id = 'project-videos'
  and public.can_access_project_video((storage.foldername(name))[1], false)
);
