import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { PER_GAME_PRICE_PHP, SUBSCRIPTION_PACKAGES, type SubscriptionPackageKey } from "@/lib/portal/billing";
import type { AnnotationScope } from "@/lib/portal/store";

/**
 * Creates a real, one-time (not recurring — see lib/portal/billing.ts)
 * Stripe Checkout Session in PHP for either a per-game purchase or a
 * subscription-package bundle. This route only ever creates the
 * session — it never grants credits itself. Credits are granted
 * exclusively by app/api/webhooks/stripe/route.ts once Stripe confirms
 * the payment actually completed, verified by signature. Trusting a
 * client-supplied "it worked" redirect (the old approach here) would
 * let anyone reach the success URL without ever paying.
 */

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  return new Stripe(secretKey);
}

type CheckoutBody =
  | { kind: "per_game"; scope: AnnotationScope; quantity: number }
  | { kind: "subscription"; package: SubscriptionPackageKey };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

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

  let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  let metadata: Record<string, string>;

  if (body.kind === "per_game") {
    const quantity = Math.floor(body.quantity);
    if (body.scope !== "Single Team" && body.scope !== "Both Teams") {
      return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: "Quantity must be between 1 and 100." }, { status: 400 });
    }
    lineItem = {
      price_data: {
        currency: "php",
        product_data: { name: `${body.scope} — game annotation` },
        unit_amount: PER_GAME_PRICE_PHP[body.scope] * 100,
      },
      quantity,
    };
    metadata = { ownerId: user.id, kind: "per_game", scope: body.scope, quantity: String(quantity) };
  } else if (body.kind === "subscription") {
    const info = SUBSCRIPTION_PACKAGES[body.package];
    if (!info) {
      return NextResponse.json({ error: "Unknown package." }, { status: 400 });
    }
    lineItem = {
      price_data: {
        currency: "php",
        product_data: {
          name: `Hornstag ${info.label} Package`,
          description: `${info.singleTeamCredits} Single Team + ${info.bothTeamCredits} Both Teams games, expires in ${info.expiresInMonths} months`,
        },
        unit_amount: info.pricePhp * 100,
      },
      quantity: 1,
    };
    metadata = { ownerId: user.id, kind: "subscription", package: info.key };
  } else {
    return NextResponse.json({ error: "Unknown purchase kind." }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [lineItem],
      metadata,
      success_url: `${origin}/client-portal/billing?checkout=success`,
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
