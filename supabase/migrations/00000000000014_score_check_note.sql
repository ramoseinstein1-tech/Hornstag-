-- Phase 6: lets an admin record why a tagged/official score mismatch
-- exists (e.g. the annotator explained a scoreboard discrepancy) —
-- distinct from submission_note, which is the annotator's own note to
-- QA. Shown to the client alongside the score check.

alter table public.projects add column if not exists score_check_note text;
