-- Event taxonomy expansion (Phase 4 of the post-infrastructure roadmap):
-- substitutions (in/out, as two distinct types since playing-time
-- calculation later needs to know exactly who left and who entered),
-- an offensive/defensive foul split alongside the existing generic
-- personal foul, and timeouts. Timeout needs neither a team nor a
-- player (confirmed with the user), so team_side becomes nullable.

alter table public.annotation_events alter column team_side drop not null;

alter table public.annotation_events drop constraint if exists annotation_events_event_type_check;
alter table public.annotation_events add constraint annotation_events_event_type_check
  check (event_type in (
    'two_point','three_point','free_throw','assist','steal','block','turnover',
    'foul','offensive_foul','defensive_foul','technical_foul',
    'offensive_rebound','defensive_rebound',
    'substitution_in','substitution_out','timeout','custom'));

-- Rebuilt with team_side and player_id coalesced too, now that both can
-- be null (Timeout has neither) — otherwise two Timeouts at the same
-- timestamp would never collide, since Postgres treats every NULL as
-- distinct from every other NULL in a plain index comparison.
drop index if exists annotation_events_dedupe_idx;
create unique index annotation_events_dedupe_idx on public.annotation_events (
  project_id,
  timestamp_seconds,
  event_type,
  coalesce(team_side, ''),
  coalesce(player_id::text, ''),
  coalesce(made, false),
  coalesce(shot_x, -1),
  coalesce(shot_y, -1),
  coalesce(custom_label, '')
);
