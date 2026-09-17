-- Real, peso-denominated pay-per-game credits, replacing the old fake
-- localStorage subscription mock (lib/portal/billing.ts). Per-game
-- purchases never expire; subscription-bundle purchases (Rookie/
-- Starting Five/Franchise) expire on a fixed schedule from purchase.

create table public.credit_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('Single Team','Both Teams')),
  quantity_total integer not null check (quantity_total > 0),
  quantity_remaining integer not null check (quantity_remaining >= 0),
  source text not null, -- 'per_game' | 'rookie' | 'starting_five' | 'franchise'
  expires_at timestamptz, -- null = never expires (per-game purchases)
  stripe_session_id text not null unique, -- idempotency guard against webhook retries
  created_at timestamptz not null default now()
);
create index credit_batches_owner_idx on public.credit_batches(owner_id);
alter table public.credit_batches enable row level security;

create policy "credit batches visible to owner/admin" on public.credit_batches for select
  using (owner_id = auth.uid() or public.current_role() = 'admin');
-- No insert/update/delete policy for normal users at all — only
-- grant_game_credits (below), called exclusively by the Stripe webhook
-- via the service-role client, is ever allowed to write these rows.

-- Spends one credit of the given scope for the CALLING user, preferring
-- the soonest-to-expire batch first (never touches other users' rows —
-- auth.uid() scopes it, same pattern as every other RPC in this app).
-- `for update skip locked` makes concurrent calls safe.
create or replace function public.consume_game_credit(target_scope text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_id uuid;
begin
  select id into batch_id
  from credit_batches
  where owner_id = auth.uid()
    and scope = target_scope
    and quantity_remaining > 0
    and (expires_at is null or expires_at > now())
  order by (expires_at is null) asc, expires_at asc
  limit 1
  for update skip locked;

  if batch_id is null then
    return false;
  end if;

  update credit_batches set quantity_remaining = quantity_remaining - 1 where id = batch_id;
  return true;
end;
$$;

-- Grants a new credit batch. EXECUTE is deliberately NOT granted to
-- authenticated/anon — only the service-role client (the Stripe webhook,
-- which has no user session to check against) can ever call this, so a
-- signed-in client can't grant themselves free credits.
create or replace function public.grant_game_credits(
  p_owner_id uuid, p_scope text, p_quantity integer, p_source text,
  p_expires_months integer, p_stripe_session_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into credit_batches (owner_id, scope, quantity_total, quantity_remaining, source, expires_at, stripe_session_id)
  values (
    p_owner_id, p_scope, p_quantity, p_quantity, p_source,
    case when p_expires_months is null then null else now() + (p_expires_months || ' months')::interval end,
    p_stripe_session_id
  )
  on conflict (stripe_session_id) do nothing; -- idempotent against webhook retries
end;
$$;
revoke execute on function public.grant_game_credits(uuid, text, integer, text, integer, text) from public, authenticated, anon;
