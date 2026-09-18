-- Refund the credit a client spent creating a project the admin later
-- rejects as unannotatable (corrupt video, wrong footage, etc.) — they
-- didn't get usable results out of it through no fault of their own.
-- Reuses grant_game_credits (same lockdown as everywhere else it's
-- used) rather than trying to reverse whichever specific batch was
-- originally decremented, since consume_game_credit doesn't track
-- that — a fresh, never-expiring 1-credit batch is simplest and
-- equivalent.
create or replace function public.reject_project(target_project_id uuid, reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  project_name text;
  project_scope text;
  caller_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can reject a project.';
  end if;

  select owner_id, name, scope into owner, project_name, project_scope from public.projects where id = target_project_id;
  if owner is null then
    return false;
  end if;

  select name into caller_name from public.profiles where id = auth.uid();

  update public.projects
  set annotation_status = 'Rejected', status = 'Rejected', rejection_reason = nullif(trim(reason), '')
  where id = target_project_id;

  perform public.grant_game_credits(
    owner, project_scope, 1, 'project_rejected_refund', null,
    'refund-' || target_project_id::text
  );

  insert into public.activity_log (user_id, text)
  values (owner, format('"%s" was rejected and will not be annotated — your credit has been refunded.', project_name));

  insert into public.audit_logs (project_id, actor_id, actor_name, actor_role, summary)
  values (target_project_id, auth.uid(), coalesce(caller_name, 'Someone'), 'admin',
    format('%s rejected "%s" (credit refunded).%s', coalesce(caller_name, 'Someone'), project_name,
      case when nullif(trim(reason), '') is not null then ' Reason: ' || trim(reason) else '' end));

  return true;
end;
$$;
