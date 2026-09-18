import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin-only: manually grants game credits to a client — the safety
 * valve for when the Stripe webhook fails to grant a real payment's
 * credits (a deploy mid-request, a transient network blip, Stripe's
 * retries exhausting). Uses the service-role client to call
 * grant_game_credits directly (its EXECUTE grant is revoked from every
 * other role — see supabase/migrations/00000000000022_manual_credit_grants.sql),
 * same pattern as every other admin-only route in this app. `reason`
 * is required and stored on the credit_batches row itself, visible in
 * both the admin Users page and the client's own Purchase History.
 */
export async function POST(request: Request) {
  const { ownerId, scope, quantity, reason } = await request.json();

  if (!ownerId || typeof ownerId !== "string") {
    return NextResponse.json({ error: "Missing ownerId." }, { status: 400 });
  }
  if (scope !== "Single Team" && scope !== "Both Teams") {
    return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
  }
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 1000) {
    return NextResponse.json({ error: "Quantity must be between 1 and 1000." }, { status: 400 });
  }
  if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required for a manual grant." }, { status: 400 });
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
  const { error } = await admin.rpc("grant_game_credits", {
    p_owner_id: ownerId,
    p_scope: scope,
    p_quantity: qty,
    p_source: "manual_grant",
    p_expires_months: null,
    p_stripe_session_id: `manual-${crypto.randomUUID()}`,
    p_note: reason.trim(),
    p_granted_by: caller.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
