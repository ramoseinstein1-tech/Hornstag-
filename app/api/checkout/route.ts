import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { PLANS, type PlanTier } from "@/lib/portal/billing";

/**
 * Creates a real Stripe Checkout Session for a subscription plan.
 *
 * IMPORTANT ARCHITECTURE NOTE: this app has no real backend database —
 * auth and billing state live in the browser's localStorage (see
 * lib/auth/mockAuthStore.ts and lib/portal/billing.ts). That means this
 * endpoint can create genuine, payable Stripe Checkout Sessions, but
 * there is nowhere server-side to durably record "this user is now on
 * the Pro plan" once payment succeeds. The client reads the redirect
 * back from Stripe (see the billing page) and updates its own local
 * mock plan state — which is NOT a secure or production-safe way to
 * gate paid features, since a user could reach that URL without ever
 * paying. Before charging real customers for real access, this needs:
 *   1. A real database associating users with Stripe customer/
 *      subscription IDs.
 *   2. A webhook handler (checkout.session.completed /
 *      customer.subscription.updated) that is the ONLY thing allowed
 *      to mark a plan as active, verified via the Stripe signature.
 */

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  return new Stripe(secretKey);
}

export async function POST(request: NextRequest) {
  let body: { tier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const tier = body.tier as PlanTier | undefined;
  if (!tier || !(tier in PLANS)) {
    return NextResponse.json({ error: "Unknown plan tier." }, { status: 400 });
  }

  const plan = PLANS[tier];
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return NextResponse.json(
      { error: "Stripe is not configured on this deployment (missing STRIPE_SECRET_KEY)." },
      { status: 500 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Hornstag ${plan.tier} Plan`,
              description: `${plan.projectsIncluded} projects / month · ${plan.turnaround} turnaround`,
            },
            unit_amount: Math.round(plan.price * 100),
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/client-portal/billing?checkout=success&tier=${encodeURIComponent(tier)}`,
      cancel_url: `${origin}/client-portal/billing?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
