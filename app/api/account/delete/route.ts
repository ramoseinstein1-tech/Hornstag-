import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Deletes the CALLER'S OWN account. Verifies the session server-side
 * first (never trusts a client-supplied user id), then uses the service
 * role to actually remove the auth.users row — the anon key has no
 * permission to do that. Every profiles/projects/etc. row cascades via
 * `on delete cascade` foreign keys defined in the schema.
 *
 * A client specifically is blocked from self-deleting while they still
 * have unused game credits or a project that isn't finished yet —
 * deleting would silently forfeit paid-for credits with no recourse,
 * or orphan a project mid-annotation. Admin-initiated deletes
 * (app/api/admin/delete-user) intentionally have no such guard — an
 * admin can still force-delete an account when needed. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role === "client") {
    const [{ data: creditRows }, { data: activeProjects }] = await Promise.all([
      supabase.from("credit_batches").select("quantity_remaining, expires_at").eq("owner_id", user.id),
      supabase.from("projects").select("id").eq("owner_id", user.id).not("status", "in", "(Completed,Rejected)"),
    ]);

    const hasUnusedCredits = (creditRows ?? []).some(
      (b) => b.quantity_remaining > 0 && (!b.expires_at || new Date(b.expires_at).getTime() > Date.now())
    );
    if (hasUnusedCredits) {
      return NextResponse.json(
        { error: "You still have unused game credits. Contact support if you need help before deleting your account." },
        { status: 409 }
      );
    }
    if ((activeProjects ?? []).length > 0) {
      return NextResponse.json(
        { error: "You have a project that isn't finished yet. Please wait until it's completed or rejected before deleting your account." },
        { status: 409 }
      );
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
