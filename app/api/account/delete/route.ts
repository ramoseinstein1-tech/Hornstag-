import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Deletes the CALLER'S OWN account. Verifies the session server-side
 * first (never trusts a client-supplied user id), then uses the service
 * role to actually remove the auth.users row — the anon key has no
 * permission to do that. Every profiles/projects/etc. row cascades via
 * `on delete cascade` foreign keys defined in the schema. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
