-- Patch for a security hole in the initial migration: handle_new_user()
-- trusted a client-supplied "role" in signup metadata, which would have
-- let anyone self-assign role='admin' at signup. Every signup should
-- always become 'client' — role only ever changes afterward via the
-- accept_annotator_invite / bootstrap_admin_if_none_exists RPCs.
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
  insert into public.billing_accounts (user_id) values (new.id);
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;
