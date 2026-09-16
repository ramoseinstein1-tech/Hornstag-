-- Phase 5: a real basketball game clock, distinct from the video's own
-- timestamp. It's a function of video position rather than wall-clock
-- time, so only a tiny reference state is needed per period to
-- reconstruct "what does the clock read right now" from any video
-- position, including after a rewind or a page reload:
--
--   clock_running
--     ? clock_reference_value_seconds - (t - clock_reference_video_seconds)
--     : clock_reference_value_seconds
--
-- clock_reference_video_seconds is null until the period's clock is
-- first started (the annotator types the period's starting time, e.g.
-- 10:00, then clicks START at the jump ball) — that null is exactly the
-- "not started yet" state the UI checks for.

alter table public.video_segments add column if not exists clock_reference_video_seconds numeric;
alter table public.video_segments add column if not exists clock_reference_value_seconds numeric;
alter table public.video_segments add column if not exists clock_running boolean not null default false;

alter table public.annotation_events add column if not exists game_clock_seconds numeric;
