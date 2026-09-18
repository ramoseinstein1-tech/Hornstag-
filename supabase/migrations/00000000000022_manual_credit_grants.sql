-- Safety valve for the pay-per-game credit system: right now, credits
-- are only ever granted by the Stripe webhook. If it ever fails for a
-- real customer (a deploy mid-request, a transient network blip,
-- Stripe's retries exhausting), a real person could pay real money and
-- get nothing, with no way to fix it short of hand-editing the
-- database. This adds an admin-only manual grant path, traceable via a
-- note + the granting admin's id right on the credit_batches row
-- itself (visible in the client's own Purchase History too).

alter table public.credit_batches add column note text;
alter table public.credit_batches add column granted_by uuid references public.profiles(id) on delete set null;

-- Adding p_note/p_granted_by changes the function's argument-type
-- signature (not just a body edit), so this is a genuinely new
-- function as far as Postgres's grant system is concerned — drop the
-- old 6-arg one explicitly rather than relying on create-or-replace to
-- carry anything over, and re-revoke execute on the new 8-arg
-- signature the same way the original migration did.
drop function if exists public.grant_game_credits(uuid, text, integer, text, integer, text);

create function public.grant_game_credits(
  p_owner_id uuid, p_scope text, p_quantity integer, p_source text,
  p_expires_months integer, p_stripe_session_id text,
  p_note text default null, p_granted_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into credit_batches (owner_id, scope, quantity_total, quantity_remaining, source, expires_at, stripe_session_id, note, granted_by)
  values (
    p_owner_id, p_scope, p_quantity, p_quantity, p_source,
    case when p_expires_months is null then null else now() + (p_expires_months || ' months')::interval end,
    p_stripe_session_id, p_note, p_granted_by
  )
  on conflict (stripe_session_id) do nothing;
end;
$$;
revoke execute on function public.grant_game_credits(uuid, text, integer, text, integer, text, text, uuid) from public, authenticated, anon;
