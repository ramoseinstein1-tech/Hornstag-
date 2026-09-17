-- Security review fixes:
--
-- 1. "clients manage own projects" was `for all`, which silently
--    included DELETE — a client could delete their own project row
--    directly, bypassing the admin-only delete flow entirely (its
--    typed-name confirmation AND, critically, the R2 cleanup that
--    removes the uploaded video/clips — see
--    app/api/videos/delete-project/route.ts). Split into explicit
--    select/insert/update policies with no delete policy at all:
--    clients can no longer delete a project through the database,
--    matching the app's actual design (delete is admin-only).
drop policy "clients manage own projects" on public.projects;
create policy "clients read own projects" on public.projects for select
  using (owner_id = auth.uid());
create policy "clients insert own projects" on public.projects for insert
  with check (owner_id = auth.uid());
create policy "clients update own projects" on public.projects for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 2. "events/segments editable by assignee" only checked claimed_by,
--    with no status condition — an annotator kept full insert/update/
--    delete access for the entire lifetime of their claim, even after
--    submitting for review or after a project was QA-approved and
--    shown to the client as final. The app's own principle
--    ("submission is a one-way door") was enforced only by the
--    workspace UI's readOnly flag, not the database. Now matches the
--    same ('Claimed','Correction Required') states the
--    submit_for_review RPC itself already treats as the annotator's
--    active-editing window (see 00000000000015_correction_required.sql).
drop policy "events editable by assignee/admin" on public.annotation_events;
create policy "events editable by assignee/admin" on public.annotation_events for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          (p.claimed_by = auth.uid() and p.annotation_status in ('Claimed', 'Correction Required'))
          or public.current_role() = 'admin'
        )
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          (p.claimed_by = auth.uid() and p.annotation_status in ('Claimed', 'Correction Required'))
          or public.current_role() = 'admin'
        )
    )
  );

drop policy "segments editable by assignee/admin" on public.video_segments;
create policy "segments editable by assignee/admin" on public.video_segments for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          (p.claimed_by = auth.uid() and p.annotation_status in ('Claimed', 'Correction Required'))
          or public.current_role() = 'admin'
        )
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          (p.claimed_by = auth.uid() and p.annotation_status in ('Claimed', 'Correction Required'))
          or public.current_role() = 'admin'
        )
    )
  );
