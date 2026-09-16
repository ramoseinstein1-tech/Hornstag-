-- Bug fix: period was stored as integer, but period labels are "Q1"/
-- "H1" etc, not numbers — Number("Q1") is NaN, which silently becomes
-- null over the wire, so this column has always been null in
-- production. Switching to text so the real label round-trips.
alter table public.annotation_events
  alter column period type text using period::text;
