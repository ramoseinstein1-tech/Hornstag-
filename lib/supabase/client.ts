import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components — safe to use in the browser,
 * the anon key is designed to be public (RLS is the real security
 * boundary, not secrecy of this key). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
