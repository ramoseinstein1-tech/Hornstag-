-- billing_accounts and invoices were part of the original schema design
-- (speculative real-billing tables), but were never actually wired up
-- to any app code — lib/portal/billing.ts stayed a localStorage mock
-- until the real pay-per-game credit system replaced it entirely with
-- credit_batches (00000000000019_game_credits.sql). Dropping this dead
-- schema; RLS policies on both tables are dropped automatically along
-- with the tables.
--
-- handle_new_user() (00000000000001_fix_role_trust.sql) provisions a
-- billing_accounts row on every signup — that insert has to go first,
-- or every new signup would start failing the instant the table is
-- dropped out from under it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    'client'
  );
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;

drop table if exists public.invoices;
drop table if exists public.billing_accounts;
