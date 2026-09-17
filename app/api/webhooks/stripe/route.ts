import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUBSCRIPTION_PACKAGES, type SubscriptionPackageKey } from "@/lib/portal/billing";

/**
 * The ONLY thing allowed to grant real game credits (see
 * supabase/migrations/00000000000019_game_credits.sql's grant_game_credits,
 * whose EXECUTE grant is revoked from every other role). Verified by
 * Stripe's signature, not by anything the browser says — the old billing
 * flow trusted a client-supplied redirect instead of this, which is
 * exactly the gap this route closes.
 *
 * Needs the raw request body (not the parsed JSON) since Stripe's
 * signature covers the exact bytes sent.
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured on this deployment." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};
  const admin = createAdminClient();

  if (metadata.kind === "per_game") {
    const scope = metadata.scope;
    const quantity = Number(metadata.quantity);
    if ((scope === "Single Team" || scope === "Both Teams") && Number.isFinite(quantity) && quantity > 0) {
      await admin.rpc("grant_game_credits", {
        p_owner_id: metadata.ownerId,
        p_scope: scope,
        p_quantity: quantity,
        p_source: "per_game",
        p_expires_months: null,
        p_stripe_session_id: session.id,
      });
    }
  } else if (metadata.kind === "subscription") {
    const info = SUBSCRIPTION_PACKAGES[metadata.package as SubscriptionPackageKey];
    if (info) {
      if (info.singleTeamCredits > 0) {
        await admin.rpc("grant_game_credits", {
          p_owner_id: metadata.ownerId,
          p_scope: "Single Team",
          p_quantity: info.singleTeamCredits,
          p_source: info.key,
          p_expires_months: info.expiresInMonths,
          p_stripe_session_id: `${session.id}-single`,
        });
      }
      if (info.bothTeamCredits > 0) {
        await admin.rpc("grant_game_credits", {
          p_owner_id: metadata.ownerId,
          p_scope: "Both Teams",
          p_quantity: info.bothTeamCredits,
          p_source: info.key,
          p_expires_months: info.expiresInMonths,
          p_stripe_session_id: `${session.id}-both`,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
