-- Manual e-wallet payments (GCash/UnionDigital/GoTyme), since going
-- live on Stripe needs business verification the startup isn't ready
-- for yet. A client submits a claim after paying via QR; an admin
-- checks their own wallet app and approves (granting real credits via
-- grant_game_credits — see 00000000000019_game_credits.sql /
-- 00000000000022_manual_credit_grants.sql, the same lockdown already
-- built for the webhook-failure safety valve) or rejects it.

create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('per_game','subscription')),
  scope text check (scope in ('Single Team','Both Teams')),
  quantity integer check (quantity > 0),
  package text check (package in ('rookie','starting_five','franchise')),
  amount_php integer not null check (amount_php > 0),
  payment_method text not null check (payment_method in ('gcash','uniondigital','gotyme')),
  reference_number text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_claims_kind_fields check (
    (kind = 'per_game' and scope is not null and quantity is not null and package is null)
    or (kind = 'subscription' and package is not null and scope is null and quantity is null)
  )
);
create index payment_claims_owner_idx on public.payment_claims(owner_id);
create index payment_claims_status_idx on public.payment_claims(status);
alter table public.payment_claims enable row level security;

create policy "payment claims visible to owner/admin" on public.payment_claims for select
  using (owner_id = auth.uid() or public.current_role() = 'admin');
create policy "payment claims insertable by owner" on public.payment_claims for insert
  with check (owner_id = auth.uid());
-- No update/delete policy for anyone — a submitted claim is final from
-- the client's side; only the admin-gated API routes (using the
-- service-role client) can ever change status, same "server code owns
-- the transition" pattern as every pipeline RPC in this app.
