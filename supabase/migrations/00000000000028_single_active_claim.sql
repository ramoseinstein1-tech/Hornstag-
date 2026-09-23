-- One active match per annotator at a time. Previously nothing stopped
-- an annotator from claiming several Unclaimed matches in a row —
-- claim_for_annotation only checked the TARGET project's own status,
-- never whether the caller already had one in progress. Enforced here
-- (not just in the UI) since RLS/RPCs own every state transition in
-- this app, same as every other business rule.
create or replace function public.claim_for_annotation(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller_role text := public.current_role();
  caller_name text;
  current_status text;
  already_active boolean;
begin
  if caller_role != 'annotator' then
    raise exception 'Only annotators can claim a match.';
  end if;

  select exists(
    select 1 from public.projects
    where claimed_by = auth.uid() and annotation_status in ('Claimed', 'Correction Required')
  ) into already_active;
  if already_active then
    raise exception 'You already have a match in progress — submit it for review before claiming another.';
  end if;

  select annotation_status into current_status from public.projects where id = target_project_id;
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

  return true;
end;
$$;
