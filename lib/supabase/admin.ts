import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE CLIENT — server-only, bypasses Row Level Security entirely.
 * Never import this from a Client Component or anything that ships to the
 * browser. Only use it inside Route Handlers for operations the anon key
 * genuinely can't do (deleting an auth.users row, which requires Supabase's
 * admin API) — everything else should go through the normal RLS-protected
 * client so the database's own security rules stay the single source of
 * truth.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
