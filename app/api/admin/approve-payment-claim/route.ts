import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUBSCRIPTION_PACKAGES, type SubscriptionPackageKey } from "@/lib/portal/billing";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/portal/paymentClaims";

/**
 * Admin-only: approves a pending e-wallet payment claim, granting real
 * credits via grant_game_credits (EXECUTE revoked from every role but
 * service-role — see supabase/migrations/00000000000019_game_credits.sql /
 * 00000000000022_manual_credit_grants.sql), the same mechanism already
 * built for the webhook-failure safety valve. Subscription-package
 * pricing/credits are looked up from SUBSCRIPTION_PACKAGES (the same
 * TypeScript constant the Stripe webhook uses) rather than duplicated
 * in SQL, so there's exactly one source of truth for package contents.
 */
export async function POST(request: Request) {
  const { claimId } = await request.json();
  if (!claimId || typeof claimId !== "string") {
    return NextResponse.json({ error: "Missing claimId." }, { status: 400 });
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
  const { data: claim, error: claimError } = await admin
    .from("payment_claims")
    .select("*")
    .eq("id", claimId)
    .eq("status", "pending")
    .single();
  if (claimError || !claim) {
    return NextResponse.json({ error: "Claim not found or already reviewed." }, { status: 404 });
  }

  const note = `${PAYMENT_METHOD_LABELS[claim.payment_method as PaymentMethod]} payment, ref ${claim.reference_number}`;

  if (claim.kind === "per_game") {
    const { error } = await admin.rpc("grant_game_credits", {
      p_owner_id: claim.owner_id,
      p_scope: claim.scope,
      p_quantity: claim.quantity,
      p_source: "ewallet_claim",
      p_expires_months: null,
      p_stripe_session_id: `claim-${claim.id}`,
      p_note: note,
      p_granted_by: caller.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const info = SUBSCRIPTION_PACKAGES[claim.package as SubscriptionPackageKey];
    if (!info) return NextResponse.json({ error: "Unknown package on this claim." }, { status: 500 });

    if (info.singleTeamCredits > 0) {
      const { error } = await admin.rpc("grant_game_credits", {
        p_owner_id: claim.owner_id,
        p_scope: "Single Team",
        p_quantity: info.singleTeamCredits,
        p_source: claim.package,
        p_expires_months: info.expiresInMonths,
        p_stripe_session_id: `claim-${claim.id}-single`,
        p_note: note,
        p_granted_by: caller.id,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (info.bothTeamCredits > 0) {
      const { error } = await admin.rpc("grant_game_credits", {
        p_owner_id: claim.owner_id,
        p_scope: "Both Teams",
        p_quantity: info.bothTeamCredits,
        p_source: claim.package,
        p_expires_months: info.expiresInMonths,
        p_stripe_session_id: `claim-${claim.id}-both`,
        p_note: note,
        p_granted_by: caller.id,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { error: updateError } = await admin
    .from("payment_claims")
    .update({ status: "approved", reviewed_by: caller.id, reviewed_at: new Date().toISOString() })
    .eq("id", claimId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
