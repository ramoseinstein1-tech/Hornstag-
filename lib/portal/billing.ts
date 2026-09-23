/**
 * REAL, SUPABASE-BACKED GAME CREDITS
 * ─────────────────────────────────────────────────────────────────
 * Replaces the old localStorage mock (fake monthly USD subscription
 * tiers, no real payment tracking). Credits are real rows in
 * `credit_batches` (see supabase/migrations/00000000000019_game_credits.sql),
 * granted only by the Stripe webhook (app/api/webhooks/stripe/route.ts)
 * once a payment actually completes — never by the client itself.
 *
 * Two ways to get credits:
 *  - Per-game, pay-as-you-go (PER_GAME_PRICE_PHP) — never expire.
 *  - A one-time subscription-package bundle (SUBSCRIPTION_PACKAGES) —
 *    expires on a fixed schedule from purchase, doesn't renew.
 */

import { createClient } from "@/lib/supabase/client";
import type { AnnotationKind, AnnotationScope } from "./store";

export const PER_GAME_PRICE_PHP: Record<AnnotationScope, number> = {
  "Single Team": 450,
  "Both Teams": 950,
};

/** Heart Stats — a separate, per-game-only annotation package (no
 * subscription bundle yet) tracking hustle/effort plays instead of a
 * traditional box score. Priced a bit cheaper than traditional since
 * it's a narrower stat set, but not steeply discounted — tagging
 * subtle hustle plays takes just as much careful film-watching as
 * counting points. */
export const HEART_STATS_PRICE_PHP: Record<AnnotationScope, number> = {
  "Single Team": 400,
  "Both Teams": 800,
};

export type SubscriptionPackageKey = "rookie" | "starting_five" | "franchise";

export type SubscriptionPackageInfo = {
  key: SubscriptionPackageKey;
  label: string;
  pricePhp: number;
  singleTeamCredits: number;
  bothTeamCredits: number;
  expiresInMonths: number;
};

export const SUBSCRIPTION_PACKAGES: Record<SubscriptionPackageKey, SubscriptionPackageInfo> = {
  rookie: {
    key: "rookie",
    label: "Rookie",
    pricePhp: 3800,
    singleTeamCredits: 8,
    bothTeamCredits: 0,
    expiresInMonths: 2,
  },
  starting_five: {
    key: "starting_five",
    label: "Starting Five",
    pricePhp: 6500,
    singleTeamCredits: 5,
    bothTeamCredits: 5,
    expiresInMonths: 3,
  },
  franchise: {
    key: "franchise",
    label: "League Pass",
    pricePhp: 12000,
    singleTeamCredits: 10,
    bothTeamCredits: 10,
    expiresInMonths: 4,
  },
};

export const SUBSCRIPTION_PACKAGE_ORDER: SubscriptionPackageKey[] = ["rookie", "starting_five", "franchise"];

export type CreditBatch = {
  id: string;
  scope: AnnotationScope;
  annotationKind: AnnotationKind;
  quantityTotal: number;
  quantityRemaining: number;
  source: string;
  expiresAt?: string;
  createdAt: string;
  /** Only set for an admin's manual grant (the webhook-failure safety
   * valve) — explains why, shown in both the admin Users page and the
   * client's own Purchase History. Undefined for a real purchase. */
  note?: string;
};

type CreditBatchRow = {
  id: string;
  scope: AnnotationScope;
  annotation_kind: AnnotationKind;
  quantity_total: number;
  quantity_remaining: number;
  source: string;
  expires_at: string | null;
  created_at: string;
  note: string | null;
};

function mapBatchRow(row: CreditBatchRow): CreditBatch {
  return {
    id: row.id,
    scope: row.scope,
    annotationKind: row.annotation_kind,
    quantityTotal: row.quantity_total,
    quantityRemaining: row.quantity_remaining,
    source: row.source,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    note: row.note ?? undefined,
  };
}

/** Admin-only: manually grants credits to a client — the safety valve
 * for when the Stripe webhook fails to grant a real payment's credits.
 * Enforced server-side (app/api/admin/grant-credits); this is just a
 * thin fetch wrapper. */
export async function grantGameCreditsManually(
  ownerId: string,
  scope: AnnotationScope,
  quantity: number,
  reason: string,
  kind: AnnotationKind = "traditional"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/admin/grant-credits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerId, scope, quantity, reason, kind }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Couldn't grant credits." };
  return { ok: true };
}

/** Every credit batch the CALLER owns — RLS restricts this to the
 * signed-in user's own rows regardless of the userId passed in. */
export async function getCreditBatches(userId: string): Promise<CreditBatch[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("credit_batches")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as CreditBatchRow[]).map(mapBatchRow);
}

function isExpired(batch: CreditBatch): boolean {
  return batch.expiresAt != null && new Date(batch.expiresAt).getTime() <= Date.now();
}

/** Sums quantity_remaining per scope across every non-expired batch of
 * the given annotation kind — what the billing page shows as the
 * current usable balance. Traditional and Heart Stats credits are
 * never summed together; they're separate pools. */
export function creditBalance(
  batches: CreditBatch[],
  kind: AnnotationKind = "traditional"
): Record<AnnotationScope, number> {
  const balance: Record<AnnotationScope, number> = { "Single Team": 0, "Both Teams": 0 };
  for (const batch of batches) {
    if (isExpired(batch) || batch.annotationKind !== kind) continue;
    balance[batch.scope] += batch.quantityRemaining;
  }
  return balance;
}
