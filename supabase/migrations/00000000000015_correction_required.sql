-- Phase 7: a distinct "Correction Required" status so a project QA
-- bounced back is visibly different, on the annotator's own Tasks
-- board, from a project they've never touched yet — today both land in
-- the exact same 'Claimed' bucket. Also adds a real audit log: an
-- annotation_events trigger (guarantees every change is captured
-- regardless of which code path writes to that table) plus one insert
-- per existing pipeline RPC, in the same pre-formatted-text style
-- already used by activity_log.

alter table public.projects drop constraint if exists projects_annotation_status_check;
alter table public.projects add constraint projects_annotation_status_check
  check (annotation_status in ('Unclaimed','Claimed','Correction Required','In Review','Completed','Rejected'));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  actor_role text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index audit_logs_project_id_idx on public.audit_logs(project_id);
alter table public.audit_logs enable row level security;
create policy "audit logs visible to admin" on public.audit_logs for select using (public.current_role() = 'admin');

-- ── annotation_events change trigger ─────────────────────────────────
-- Only logs UPDATEs that change something affecting scoring/stats
-- (event type, made/missed, player) -- not every incidental field touch.
create function public.log_annotation_event_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_name text;
  actor_role text;
  summary text;
begin
  select p.name, p.role into actor_name, actor_role from public.profiles p where p.id = auth.uid();
  actor_name := coalesce(actor_name, 'Someone');
  actor_role := coalesce(actor_role, 'unknown');

  if TG_OP = 'INSERT' then
    summary := format('%s tagged %s', actor_name, coalesce(NEW.custom_label, NEW.event_type));
    insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
    values (NEW.project_id, auth.uid(), actor_name, actor_role, summary);
    return NEW;
  elsif TG_OP = 'UPDATE' and (
    OLD.event_type is distinct from NEW.event_type
    or OLD.made is distinct from NEW.made
    or OLD.player_id is distinct from NEW.player_id
  ) then
    summary := format('%s changed an event: %s%s → %s%s', actor_name,
      OLD.event_type, case when OLD.made is not null then case when OLD.made then ' (made)' else ' (missed)' end else '' end,
      NEW.event_type, case when NEW.made is not null then case when NEW.made then ' (made)' else ' (missed)' end else '' end);
    insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
    values (NEW.project_id, auth.uid(), actor_name, actor_role, summary);
    return NEW;
  elsif TG_OP = 'DELETE' then
    summary := format('%s deleted a tagged %s', actor_name, coalesce(OLD.custom_label, OLD.event_type));
    insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
    values (OLD.project_id, auth.uid(), actor_name, actor_role, summary);
    return OLD;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists annotation_events_audit on public.annotation_events;
create trigger annotation_events_audit
after insert or update or delete on public.annotation_events
for each row execute function public.log_annotation_event_change();

-- ── pipeline RPCs: add Correction Required handling + audit inserts ──

create or replace function public.claim_for_annotation(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller_role text := public.current_role();
  caller_name text;
  current_status text;
  project_name text;
begin
  if caller_role != 'annotator' then
    raise exception 'Only annotators can claim a match.';
  end if;

  select annotation_status, name into current_status, project_name from public.projects where id = target_project_id;
  if current_status is distinct from 'Unclaimed' then
    return false;
  end if;

  select name into caller_name from public.profiles where id = auth.uid();

  update public.projects
  set annotation_status = 'Claimed',
      status = 'In Progress',
      progress = 50,
      claimed_by = auth.uid(),
      claimed_by_name = caller_name,
      claimed_at = now()
  where id = target_project_id;

  insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
  values (target_project_id, auth.uid(), coalesce(caller_name, 'Someone'), caller_role,
    format('%s claimed "%s" for annotation.', coalesce(caller_name, 'Someone'), project_name));

  return true;
end;
$$;

create or replace function public.submit_for_review(target_project_id uuid, note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller_name text;
  project_name text;
begin
  if public.current_role() != 'annotator' then
    raise exception 'Only the assigned annotator can submit for review.';
  end if;

  select name into caller_name from public.profiles where id = auth.uid();
  select name into project_name from public.projects where id = target_project_id;

  update public.projects
  set annotation_status = 'In Review',
      status = 'Needs Review',
      progress = 90,
      submission_note = nullif(trim(note), '')
  where id = target_project_id
    and claimed_by = auth.uid()
    and annotation_status in ('Claimed', 'Correction Required');

  if found then
    insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
    values (target_project_id, auth.uid(), coalesce(caller_name, 'Someone'), 'annotator',
      format('%s submitted "%s" for QA review.', coalesce(caller_name, 'Someone'), project_name));
  end if;

  return found;
end;
$$;

create or replace function public.approve_and_complete(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  project_name text;
  caller_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can approve and complete a match.';
  end if;

  select owner_id, name into owner, project_name from public.projects where id = target_project_id;
  select name into caller_name from public.profiles where id = auth.uid();

  update public.projects
  set annotation_status = 'Completed', status = 'Completed', progress = 100, completed_at = now()
  where id = target_project_id;

  insert into public.activity_log (user_id, text)
  values (owner, format('QA approved — results for "%s" are ready to view.', project_name));

  insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
  values (target_project_id, auth.uid(), coalesce(caller_name, 'Someone'), 'admin',
    format('%s approved and completed "%s".', coalesce(caller_name, 'Someone'), project_name));

  return true;
end;
$$;

create or replace function public.send_back_to_annotator(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller_name text;
  project_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can send a match back.';
  end if;

  select name into caller_name from public.profiles where id = auth.uid();
  select name into project_name from public.projects where id = target_project_id;

  update public.projects
  set annotation_status = 'Correction Required', status = 'In Progress', progress = 50
  where id = target_project_id and annotation_status = 'In Review';

  if found then
    insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
    values (target_project_id, auth.uid(), coalesce(caller_name, 'Someone'), 'admin',
      format('%s sent "%s" back for correction.', coalesce(caller_name, 'Someone'), project_name));
  end if;

  return found;
end;
$$;

create or replace function public.reopen_for_review(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller_name text;
  project_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can reopen a completed match.';
  end if;

  select name into caller_name from public.profiles where id = auth.uid();
  select name into project_name from public.projects where id = target_project_id;

  update public.projects
  set annotation_status = 'In Review', status = 'Needs Review', progress = 90
  where id = target_project_id and annotation_status = 'Completed';

  if found then
    insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
    values (target_project_id, auth.uid(), coalesce(caller_name, 'Someone'), 'admin',
      format('%s reopened "%s" for review.', coalesce(caller_name, 'Someone'), project_name));
  end if;

  return found;
end;
$$;

create or replace function public.unassign_annotator(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller_name text;
  project_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can unassign an annotator.';
  end if;

  select name into caller_name from public.profiles where id = auth.uid();
  select name into project_name from public.projects where id = target_project_id;

  update public.projects
  set annotation_status = 'Unclaimed', status = 'Processing', progress = 4,
      claimed_by = null, claimed_by_name = null, claimed_at = null
  where id = target_project_id and annotation_status in ('Claimed','Correction Required','In Review');

  if found then
    insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
    values (target_project_id, auth.uid(), coalesce(caller_name, 'Someone'), 'admin',
      format('%s unassigned the annotator from "%s".', coalesce(caller_name, 'Someone'), project_name));
  end if;

  return found;
end;
$$;

create or replace function public.reject_project(target_project_id uuid, reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  project_name text;
  caller_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can reject a project.';
  end if;

  select owner_id, name into owner, project_name from public.projects where id = target_project_id;
  if owner is null then
    return false;
  end if;

  select name into caller_name from public.profiles where id = auth.uid();

  update public.projects
  set annotation_status = 'Rejected', status = 'Rejected', rejection_reason = nullif(trim(reason), '')
  where id = target_project_id;

  insert into public.activity_log (user_id, text)
  values (owner, format('"%s" was rejected and will not be annotated.', project_name));

  insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
  values (target_project_id, auth.uid(), coalesce(caller_name, 'Someone'), 'admin',
    format('%s rejected "%s".%s', coalesce(caller_name, 'Someone'), project_name,
      case when nullif(trim(reason), '') is not null then ' Reason: ' || trim(reason) else '' end));

  return true;
end;
$$;
