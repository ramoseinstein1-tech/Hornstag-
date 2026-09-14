-- ═══════════════════════════════════════════════════════════════════
-- HORNSTAG — INITIAL SCHEMA (Phase 1: real database + real auth)
-- ═══════════════════════════════════════════════════════════════════
-- Run this against a fresh Supabase project (SQL Editor, or
-- `supabase db push` if using the CLI against a linked project).
-- Safe to re-run from scratch — the reset block below drops everything
-- this script creates first, so a failed partial run never blocks a
-- clean retry.

-- ── reset (safe no-op on a project that's never run this before) ─────
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.annotator_invites cascade;
drop table if exists public.activity_log cascade;
drop table if exists public.notification_prefs cascade;
drop table if exists public.team_members cascade;
drop table if exists public.invoices cascade;
drop table if exists public.billing_accounts cascade;
drop table if exists public.video_segments cascade;
drop table if exists public.annotation_events cascade;
drop table if exists public.roster_players cascade;
drop table if exists public.projects cascade;
drop table if exists public.profiles cascade;
drop function if exists public.unassign_annotator(uuid);
drop function if exists public.reopen_for_review(uuid);
drop function if exists public.send_back_to_annotator(uuid);
drop function if exists public.approve_and_complete(uuid);
drop function if exists public.submit_for_review(uuid, text);
drop function if exists public.claim_for_annotation(uuid);
drop function if exists public.current_role();
drop function if exists public.accept_annotator_invite(uuid, text);
drop function if exists public.bootstrap_admin_if_none_exists(uuid);
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();

-- ── profiles ─────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('client','annotator','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── projects ─────────────────────────────────────────────────────────
-- Folds in everything the old mock's globalProjects.ts tracked
-- separately (claim/assignment/status) — one real shared table now.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  owner_name text not null,
  name text not null,
  opponent text,
  game_date date,
  scope text not null check (scope in ('Single Team','Both Teams')),
  format text not null check (format in ('Quarters','Halves')),
  notes text,
  file_name text,
  file_size bigint,
  status text not null default 'Processing'
    check (status in ('Processing','In Progress','Needs Review','Completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  official_score_team integer,
  official_score_opponent integer,
  annotation_status text not null default 'Unclaimed'
    check (annotation_status in ('Unclaimed','Claimed','In Review','Completed')),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_by_name text,
  claimed_at timestamptz,
  submission_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects(owner_id);
create index projects_claimed_by_idx on public.projects(claimed_by);
create index projects_annotation_status_idx on public.projects(annotation_status);

-- ── roster_players ───────────────────────────────────────────────────
create table public.roster_players (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  side text not null check (side in ('team','opponent')),
  number text not null,
  name text not null,
  sort_order integer not null default 0
);
create index roster_players_project_id_idx on public.roster_players(project_id);

-- ── annotation_events ────────────────────────────────────────────────
create table public.annotation_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  timestamp_seconds numeric not null,
  team_side text not null check (team_side in ('team','opponent')),
  player_id uuid references public.roster_players(id) on delete set null,
  event_type text not null check (event_type in (
    'two_point','three_point','free_throw','assist','steal','block',
    'turnover','foul','technical_foul','offensive_rebound','defensive_rebound','custom')),
  made boolean,
  shot_x numeric check (shot_x between 0 and 1),
  shot_y numeric check (shot_y between 0 and 1),
  custom_label text,
  period integer,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index annotation_events_project_id_idx on public.annotation_events(project_id);

-- Duplicate-event rejection as a real DB constraint (was an app-level
-- pre-check with a race window between two concurrent inserts). A plain
-- UNIQUE table constraint can't reference expressions like coalesce(),
-- so this needs to be a unique index instead — and every nullable
-- column needs coalescing to a sentinel, since Postgres treats each
-- NULL as distinct from every other NULL (two non-shot events, both
-- with made/shot_x/shot_y = NULL, would otherwise never collide).
create unique index annotation_events_dedupe_idx on public.annotation_events (
  project_id,
  timestamp_seconds,
  team_side,
  player_id,
  event_type,
  coalesce(made, false),
  coalesce(shot_x, -1),
  coalesce(shot_y, -1),
  coalesce(custom_label, '')
);

-- ── video_segments ───────────────────────────────────────────────────
create table public.video_segments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  start_seconds numeric not null,
  end_seconds numeric not null check (end_seconds > start_seconds),
  sort_order integer not null default 0
);
create index video_segments_project_id_idx on public.video_segments(project_id);

-- ── billing ──────────────────────────────────────────────────────────
create table public.billing_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_tier text not null default 'Free',
  card_brand text,
  card_last4 text,
  card_expiry text,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null,
  plan_tier text not null,
  stripe_invoice_id text,
  issued_at timestamptz not null default now(),
  status text not null default 'paid' check (status in ('paid','pending','failed'))
);
create index invoices_user_id_idx on public.invoices(user_id);

-- ── team_members / notification_prefs ───────────────────────────────
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('Owner','Member'))
);
create index team_members_owner_id_idx on public.team_members(owner_id);

create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb
);

-- ── activity_log ─────────────────────────────────────────────────────
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index activity_log_user_id_idx on public.activity_log(user_id);

-- ── annotator_invites ────────────────────────────────────────────────
-- Real admin-managed invite list, replacing the old mock's shared
-- client-side access-code string.
create table public.annotator_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

-- ═══════════════════════════════════════════════════════════════════
-- updated_at maintenance
-- ═══════════════════════════════════════════════════════════════════
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_annotation_events_updated_at before update on public.annotation_events
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- New-user provisioning: create the matching profiles row on signup
-- ═══════════════════════════════════════════════════════════════════
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Every signup becomes 'client' — always, regardless of anything the
  -- signup request's own metadata claims. Role only ever changes via the
  -- security-definer RPCs below (accept_annotator_invite,
  -- bootstrap_admin_if_none_exists), never at signup time, since trusting
  -- client-supplied metadata here would let anyone self-assign 'admin'.
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    'client'
  );
  insert into public.billing_accounts (user_id) values (new.id);
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- Admin bootstrap — atomic, server-side, one-time
-- ═══════════════════════════════════════════════════════════════════
create function public.bootstrap_admin_if_none_exists(target_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    return false;
  end if;
  update public.profiles set role = 'admin' where id = target_user_id;
  return true;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Annotator invite acceptance — atomic check-and-mark
-- ═══════════════════════════════════════════════════════════════════
create function public.accept_annotator_invite(target_user_id uuid, invite_email text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  invite_id uuid;
begin
  select id into invite_id
  from public.annotator_invites
  where email = invite_email and used_at is null
  limit 1;

  if invite_id is null then
    return false;
  end if;

  update public.annotator_invites set used_at = now() where id = invite_id;
  update public.profiles set role = 'annotator' where id = target_user_id;
  return true;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Pipeline state-machine RPCs — the only way annotation_status/status
-- change. Mirrors lib/portal/pipeline.ts's role as the single source
-- of truth for valid transitions.
-- ═══════════════════════════════════════════════════════════════════
create function public.current_role()
returns text language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.claim_for_annotation(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller_role text := public.current_role();
  caller_name text;
  current_status text;
begin
  if caller_role != 'annotator' then
    raise exception 'Only annotators can claim a match.';
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

create function public.submit_for_review(target_project_id uuid, note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() != 'annotator' then
    raise exception 'Only the assigned annotator can submit for review.';
  end if;

  update public.projects
  set annotation_status = 'In Review',
      status = 'Needs Review',
      progress = 90,
      submission_note = nullif(trim(note), '')
  where id = target_project_id
    and claimed_by = auth.uid()
    and annotation_status = 'Claimed';

  return found;
end;
$$;

create function public.approve_and_complete(target_project_id uuid)
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
  set annotation_status = 'Completed', status = 'Completed', progress = 100
  where id = target_project_id;

  insert into public.activity_log (user_id, text)
  values (owner, format('QA approved — results for "%s" are ready to view.', project_name));

  return true;
end;
$$;

create function public.send_back_to_annotator(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can send a match back.';
  end if;

  update public.projects
  set annotation_status = 'Claimed', status = 'In Progress', progress = 50
  where id = target_project_id and annotation_status = 'In Review';

  return found;
end;
$$;

create function public.reopen_for_review(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can reopen a completed match.';
  end if;

  update public.projects
  set annotation_status = 'In Review', status = 'Needs Review', progress = 90
  where id = target_project_id and annotation_status = 'Completed';

  return found;
end;
$$;

create function public.unassign_annotator(target_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() != 'admin' then
    raise exception 'Only an admin can unassign an annotator.';
  end if;

  update public.projects
  set annotation_status = 'Unclaimed', status = 'Processing', progress = 4,
      claimed_by = null, claimed_by_name = null, claimed_at = null
  where id = target_project_id and annotation_status in ('Claimed','In Review');

  return found;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.roster_players enable row level security;
alter table public.annotation_events enable row level security;
alter table public.video_segments enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.invoices enable row level security;
alter table public.team_members enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.activity_log enable row level security;
alter table public.annotator_invites enable row level security;

-- profiles: everyone can read their own; admins can read/update all.
create policy "read own profile" on public.profiles for select using (id = auth.uid());
create policy "admins read all profiles" on public.profiles for select
  using (public.current_role() = 'admin');
create policy "update own profile" on public.profiles for update using (id = auth.uid());
create policy "admins update any profile" on public.profiles for update
  using (public.current_role() = 'admin');
create policy "admins delete any profile" on public.profiles for delete
  using (public.current_role() = 'admin');
create policy "self delete" on public.profiles for delete using (id = auth.uid());

-- projects
create policy "clients manage own projects" on public.projects for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "annotators read claimable or assigned projects" on public.projects for select
  using (
    public.current_role() = 'annotator'
    and (annotation_status = 'Unclaimed' or claimed_by = auth.uid())
  );
create policy "annotators update assigned project fields" on public.projects for update
  using (public.current_role() = 'annotator' and claimed_by = auth.uid())
  with check (public.current_role() = 'annotator' and claimed_by = auth.uid());
create policy "admins full access to projects" on public.projects for all
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- roster_players: owner, assigned annotator, or admin.
create policy "roster visible to owner/assignee/admin" on public.roster_players for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  );
create policy "roster editable by owner/assignee/admin" on public.roster_players for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  );

-- annotation_events / video_segments: owner (read-only), assigned annotator (read/write), admin (all).
create policy "events visible to owner/assignee/admin" on public.annotation_events for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  );
create policy "events editable by assignee/admin" on public.annotation_events for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  );

create policy "segments visible to owner/assignee/admin" on public.video_segments for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  );
create policy "segments editable by assignee/admin" on public.video_segments for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  );

-- billing / invoices: owner only (+ admin read for support purposes).
create policy "own billing" on public.billing_accounts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admins read billing" on public.billing_accounts for select
  using (public.current_role() = 'admin');
create policy "own invoices" on public.invoices for select using (user_id = auth.uid());
create policy "admins read invoices" on public.invoices for select
  using (public.current_role() = 'admin');

-- team_members / notification_prefs / activity_log: owner only.
create policy "own team members" on public.team_members for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own notification prefs" on public.notification_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own activity log" on public.activity_log for select using (user_id = auth.uid());

-- annotator_invites: admins manage; anyone can check their OWN email
-- (needed so accept_annotator_invite's caller flow can be validated
-- client-side before attempting signup, without exposing the whole list).
create policy "admins manage invites" on public.annotator_invites for all
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
