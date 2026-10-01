-- Two more Heart Stats event types: blown_by (a defender beaten off
-- the dribble — no made/missed, just a count) and screen (a good/bad
-- rating for every screen set, reusing the made column the same way
-- box_out already does — distinct from screen_assist, which only
-- counts a screen that directly led to a teammate's made basket).
alter table public.annotation_events drop constraint if exists annotation_events_event_type_check;
alter table public.annotation_events add constraint annotation_events_event_type_check
  check (event_type in (
    'two_point','three_point','free_throw','assist','steal','block','turnover',
    'foul','offensive_foul','defensive_foul','technical_foul',
    'offensive_rebound','defensive_rebound',
    'substitution_in','substitution_out','timeout','custom',
    'deflection','loose_ball_recovered','charge_drawn','screen_assist','contested_shot','box_out',
    'blown_by','screen'));
