-- Admin controls: reject an unannotatable project (any point in the
-- pipeline, distinct from send_back_to_annotator which is for quality
-- issues after work has started), plus a completed_at timestamp so the
-- annotator dashboard's weekly stat can be computed precisely rather
-- than reusing the general-purpose updated_at.

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('Processing','In Progress','Needs Review','Completed','Rejected'));

alter table public.projects drop constraint if exists projects_annotation_status_check;
alter table public.projects add constraint projects_annotation_status_check
  check (annotation_status in ('Unclaimed','Claimed','In Review','Completed','Rejected'));

alter table public.projects add column if not exists rejection_reason text;
alter table public.projects add column if not exists completed_at timestamptz;

create or replace function public.approve_and_complete(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  project_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can approve and complete a match.';
  end if;

  select owner_id, name into owner, project_name from public.projects where id = target_project_id;

  update public.projects
  set annotation_status = 'Completed', status = 'Completed', progress = 100, completed_at = now()
  where id = target_project_id;

  insert into public.activity_log (user_id, text)
  values (owner, format('QA approved — results for "%s" are ready to view.', project_name));

  return true;
end;
$$;

-- Admin override: a project that's fundamentally unannotatable (corrupt
-- video, wrong sport, duplicate upload, etc.) — callable at ANY current
-- status, unlike the claim/submit/approve state machine's other
-- transitions, since this isn't a normal pipeline step.
create or replace function public.reject_project(target_project_id uuid, reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  project_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can reject a project.';
  end if;

  select owner_id, name into owner, project_name from public.projects where id = target_project_id;
  if owner is null then
    return false;
  end if;

  update public.projects
  set annotation_status = 'Rejected', status = 'Rejected', rejection_reason = nullif(trim(reason), '')
  where id = target_project_id;

  insert into public.activity_log (user_id, text)
  values (owner, format('"%s" was rejected and will not be annotated.', project_name));

  return true;
end;
$$;
