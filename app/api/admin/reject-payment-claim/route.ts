import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Admin-only: rejects a pending e-wallet payment claim — no credits
 * granted, just records why for the client to see on their own Billing
 * page. */
export async function POST(request: Request) {
  const { claimId, note } = await request.json();
  if (!claimId || typeof claimId !== "string") {
    return NextResponse.json({ error: "Missing claimId." }, { status: 400 });
  }
  if (!note || typeof note !== "string" || note.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required to reject a claim." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", caller.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_claims")
    .update({
      status: "rejected",
      admin_note: note.trim(),
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .eq("status", "pending");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
