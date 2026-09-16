-- Phase 8: annotators and QA reviewers can flag video-quality problems
-- that affect tagging (camera away from the ball, scoreboard not
-- visible, missing footage, etc.) — visible to the client too
-- (confirmed with the user, not an internal-only tool).

create table public.video_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reported_by uuid references public.profiles(id) on delete set null,
  reporter_name text not null,
  reporter_role text not null,
  issue_type text not null check (issue_type in (
    'camera_away_from_ball','play_out_of_view','camera_shaking',
    'scoreboard_not_visible','scoreboard_incorrect','video_edited_precut',
    'missing_footage','abrupt_video_skip','black_screen','audio_only',
    'video_starts_mid_play','quarter_missing','player_identification_unclear',
    'foul_contact_not_visible','free_throw_sequence_unclear','other'
  )),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  timestamp_seconds numeric,
  period text,
  description text,
  created_at timestamptz not null default now()
);
create index video_issues_project_id_idx on public.video_issues(project_id);
alter table public.video_issues enable row level security;

-- Same owner/assignee/admin visibility pattern already used for
-- roster_players and annotation_events — now including the client
-- (owner), per the confirmed decision to make these client-visible.
create policy "video issues visible to owner/assignee/admin" on public.video_issues for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = video_issues.project_id
        and (p.owner_id = auth.uid() or p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  );

create policy "video issues insertable by assignee/admin" on public.video_issues for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = video_issues.project_id
        and (p.claimed_by = auth.uid() or public.current_role() = 'admin')
    )
  );

create policy "video issues deletable by reporter/admin" on public.video_issues for delete
  using (reported_by = auth.uid() or public.current_role() = 'admin');
