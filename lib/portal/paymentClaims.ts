/**
 * MANUAL E-WALLET PAYMENT CLAIMS
 * ─────────────────────────────────────────────────────────────────
 * A client pays via GCash/UnionDigital/GoTyme QR outside the app, then
 * submits a claim here describing what they bought and their payment
 * reference number. An admin checks their own wallet app and approves
 * (granting real credits — see app/api/admin/approve-payment-claim) or
 * rejects it. See supabase/migrations/00000000000023_payment_claims.sql
 * for the schema/RLS — a submitted claim is final from the client's
 * side; only the admin-gated API routes can change its status.
 */

import { createClient } from "@/lib/supabase/client";
import type { AnnotationKind, AnnotationScope } from "./store";
import type { SubscriptionPackageKey } from "./billing";

export type PaymentMethod = "gcash" | "uniondigital" | "gotyme";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  uniondigital: "UnionDigital",
  gotyme: "GoTyme",
};

export const PAYMENT_METHOD_ORDER: PaymentMethod[] = ["gcash", "uniondigital", "gotyme"];

export type ClaimStatus = "pending" | "approved" | "rejected";

export type PaymentClaim = {
  id: string;
  ownerId: string;
  kind: "per_game" | "subscription";
  annotationKind: AnnotationKind;
  scope?: AnnotationScope;
  quantity?: number;
  package?: SubscriptionPackageKey;
  amountPhp: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  status: ClaimStatus;
  adminNote?: string;
  reviewedAt?: string;
  createdAt: string;
  // Only populated by getPendingPaymentClaims (joins profiles) — not by
  // getMyPaymentClaims, which has no need to know its own owner's name.
  ownerName?: string;
  ownerEmail?: string;
};

type PaymentClaimRow = {
  id: string;
  owner_id: string;
  kind: "per_game" | "subscription";
  annotation_kind: AnnotationKind;
  scope: AnnotationScope | null;
  quantity: number | null;
  package: SubscriptionPackageKey | null;
  amount_php: number;
  payment_method: PaymentMethod;
  reference_number: string;
  status: ClaimStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: { name: string; email: string } | null;
};

function mapClaimRow(row: PaymentClaimRow): PaymentClaim {
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    annotationKind: row.annotation_kind,
    scope: row.scope ?? undefined,
    quantity: row.quantity ?? undefined,
    package: row.package ?? undefined,
    amountPhp: row.amount_php,
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
    status: row.status,
    adminNote: row.admin_note ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    ownerName: row.profiles?.name,
    ownerEmail: row.profiles?.email,
  };
}

export async function getMyPaymentClaims(userId: string): Promise<PaymentClaim[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_claims")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as PaymentClaimRow[]).map(mapClaimRow);
}

/** Admin only (enforced by RLS) — every pending claim across all
 * clients, oldest first so the review queue works front-to-back. */
export async function getPendingPaymentClaims(): Promise<PaymentClaim[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_claims")
    // payment_claims has two FKs into profiles (owner_id AND
    // reviewed_by) — a bare "profiles(...)" embed is ambiguous to
    // PostgREST and errors, so the owner_id relationship has to be
    // named explicitly here (PostgREST's !<column> disambiguation
    // hint, more robust than guessing Postgres's auto-generated
    // constraint name).
    .select("*, profiles!owner_id(name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getPendingPaymentClaims failed:", error.message);
    return [];
  }
  if (!data) return [];
  return (data as unknown as PaymentClaimRow[]).map(mapClaimRow);
}

export type NewPaymentClaimInput = {
  kind: "per_game" | "subscription";
  annotationKind?: AnnotationKind;
  scope?: AnnotationScope;
  quantity?: number;
  package?: SubscriptionPackageKey;
  amountPhp: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
};

export async function submitPaymentClaim(
  ownerId: string,
  input: NewPaymentClaimInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("payment_claims").insert({
    owner_id: ownerId,
    kind: input.kind,
    annotation_kind: input.annotationKind ?? "traditional",
    scope: input.scope ?? null,
    quantity: input.quantity ?? null,
    package: input.package ?? null,
    amount_php: input.amountPhp,
    payment_method: input.paymentMethod,
    reference_number: input.referenceNumber,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function approvePaymentClaim(claimId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/admin/approve-payment-claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Couldn't approve this claim." };
  return { ok: true };
}

export async function rejectPaymentClaim(
  claimId: string,
  note: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/admin/reject-payment-claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimId, note }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Couldn't reject this claim." };
  return { ok: true };
}
