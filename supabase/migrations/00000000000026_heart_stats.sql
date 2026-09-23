-- Heart Stats: a second, separate annotation package tracking hustle/
-- effort plays (deflections, loose balls recovered, charges drawn,
-- screen assists, contested shots, box outs) instead of a traditional
-- box score. A project, credit batch, or payment claim is tagged with
-- annotation_kind so a Single-Team traditional credit and a Single-Team
-- Heart Stats credit are tracked as entirely separate pools — buying
-- one never lets you spend it as the other.

alter table public.projects add column annotation_kind text not null default 'traditional'
  check (annotation_kind in ('traditional', 'heart_stats'));
alter table public.credit_batches add column annotation_kind text not null default 'traditional'
  check (annotation_kind in ('traditional', 'heart_stats'));
alter table public.payment_claims add column annotation_kind text not null default 'traditional'
  check (annotation_kind in ('traditional', 'heart_stats'));

-- Six new player-attributed event types. box_out reuses the existing
-- nullable `made` column for its successful/missed outcome — no new
-- column needed.
alter table public.annotation_events drop constraint if exists annotation_events_event_type_check;
alter table public.annotation_events add constraint annotation_events_event_type_check
  check (event_type in (
    'two_point','three_point','free_throw','assist','steal','block','turnover',
    'foul','offensive_foul','defensive_foul','technical_foul',
    'offensive_rebound','defensive_rebound',
    'substitution_in','substitution_out','timeout','custom',
    'deflection','loose_ball_recovered','charge_drawn','screen_assist','contested_shot','box_out'));

-- consume_game_credit gains target_kind so it only ever spends a batch
-- of the matching annotation kind. Adding a parameter is a new
-- signature as far as Postgres's grant system is concerned — drop the
-- old 1-arg overload explicitly rather than leaving it to sit there
-- unfiltered by kind (it relies on the default PUBLIC execute grant,
-- same as before, so no revoke/grant needed after recreating it).
drop function if exists public.consume_game_credit(text);

create function public.consume_game_credit(target_scope text, target_kind text default 'traditional')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_id uuid;
begin
  select id into batch_id
  from credit_batches
  where owner_id = auth.uid()
    and scope = target_scope
    and annotation_kind = target_kind
    and quantity_remaining > 0
    and (expires_at is null or expires_at > now())
  order by (expires_at is null) asc, expires_at asc
  limit 1
  for update skip locked;

  if batch_id is null then
    return false;
  end if;

  update credit_batches set quantity_remaining = quantity_remaining - 1 where id = batch_id;
  return true;
end;
$$;

-- grant_game_credits gains a matching p_kind, same drop-old-signature +
-- fresh-revoke pattern as when p_note/p_granted_by were added
-- (00000000000022_manual_credit_grants.sql).
drop function if exists public.grant_game_credits(uuid, text, integer, text, integer, text, text, uuid);

create function public.grant_game_credits(
  p_owner_id uuid, p_scope text, p_quantity integer, p_source text,
  p_expires_months integer, p_stripe_session_id text,
  p_note text default null, p_granted_by uuid default null, p_kind text default 'traditional'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into credit_batches (owner_id, scope, quantity_total, quantity_remaining, source, expires_at, stripe_session_id, note, granted_by, annotation_kind)
  values (
    p_owner_id, p_scope, p_quantity, p_quantity, p_source,
    case when p_expires_months is null then null else now() + (p_expires_months || ' months')::interval end,
    p_stripe_session_id, p_note, p_granted_by, p_kind
  )
  on conflict (stripe_session_id) do nothing;
end;
$$;
revoke execute on function public.grant_game_credits(uuid, text, integer, text, integer, text, text, uuid, text) from public, authenticated, anon;

-- Refund the correct kind of credit — a rejected Heart Stats project
-- should refund a Heart Stats credit, not a traditional one.
create or replace function public.reject_project(target_project_id uuid, reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  project_name text;
  project_scope text;
  project_kind text;
  caller_name text;
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can reject a project.';
  end if;

  select owner_id, name, scope, annotation_kind into owner, project_name, project_scope, project_kind
  from public.projects where id = target_project_id;
  if owner is null then
    return false;
  end if;

  select name into caller_name from public.profiles where id = auth.uid();

  update public.projects
  set annotation_status = 'Rejected', status = 'Rejected', rejection_reason = nullif(trim(reason), '')
  where id = target_project_id;

  perform public.grant_game_credits(
    p_owner_id => owner, p_scope => project_scope, p_quantity => 1,
    p_source => 'project_rejected_refund', p_expires_months => null,
    p_stripe_session_id => 'refund-' || target_project_id::text,
    p_kind => project_kind
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
