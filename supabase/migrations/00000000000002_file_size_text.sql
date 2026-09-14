-- The app has always stored file_size as an already-formatted display
-- string (e.g. "2.3 MB", from formatFileSize()), never a raw byte count —
-- the initial migration incorrectly typed this column as bigint. Table is
-- empty of real data so far, safe to just swap the column type.
alter table public.projects drop column if exists file_size;
alter table public.projects add column file_size text;
