-- Lets a saved-team player carry a stable identity across every project
-- they're loaded into, so their stats can be summed into a career
-- profile (Settings → My Teams → View Profile) instead of being stuck
-- one project at a time. roster_players still gets a fresh id per
-- project (each row belongs to exactly one project), but now optionally
-- points back at the saved_team_players row it was loaded from.
alter table public.roster_players
  add column saved_player_id uuid references public.saved_team_players(id) on delete set null;
create index roster_players_saved_player_id_idx on public.roster_players(saved_player_id);
