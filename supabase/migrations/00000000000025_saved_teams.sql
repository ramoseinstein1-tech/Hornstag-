-- Lets a client save their own team's roster once and reuse it on every
-- future upload instead of retyping it. Own team only, per the user —
-- opponents vary game to game so there's no reuse benefit there.

create table public.saved_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table public.saved_team_players (
  id uuid primary key default gen_random_uuid(),
  saved_team_id uuid not null references public.saved_teams(id) on delete cascade,
  number text not null,
  name text not null,
  sort_order integer not null default 0
);
create index saved_team_players_team_idx on public.saved_team_players(saved_team_id);
alter table public.saved_teams enable row level security;
alter table public.saved_team_players enable row level security;

create policy "own saved teams" on public.saved_teams for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own saved team players" on public.saved_team_players for all
  using (exists (select 1 from saved_teams t where t.id = saved_team_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from saved_teams t where t.id = saved_team_id and t.owner_id = auth.uid()));
