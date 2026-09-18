"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { getProjects } from "@/lib/portal/store";
import type { Project, AnnotationScope } from "@/lib/portal/store";
import {
  getCreditBatches,
  creditBalance,
  PER_GAME_PRICE_PHP,
  SUBSCRIPTION_PACKAGES,
  SUBSCRIPTION_PACKAGE_ORDER,
  type CreditBatch,
  type SubscriptionPackageKey,
} from "@/lib/portal/billing";
import {
  getMyPaymentClaims,
  submitPaymentClaim,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ORDER,
  type PaymentClaim,
  type PaymentMethod,
} from "@/lib/portal/paymentClaims";

const SCOPES: AnnotationScope[] = ["Single Team", "Both Teams"];

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="hs-panel sheen-top p-4 text-center">
      <div className="font-display text-xl font-semibold text-orange-bright">{value}</div>
      <div className="mt-1 font-mono-tech text-[0.56rem] tracking-[0.12em] text-text-faint">
        {label}
      </div>
    </div>
  );
}

function sourceLabel(source: string): string {
  if (source === "per_game" || source === "ewallet_claim") return "Per-game";
  if (source === "manual_grant") return "Manual grant";
  return SUBSCRIPTION_PACKAGES[source as SubscriptionPackageKey]?.label ?? source;
}

const CLAIM_STATUS_STYLES: Record<PaymentClaim["status"], string> = {
  pending: "text-orange-bright",
  approved: "text-[#7cd48a]",
  rejected: "text-[#ff9b9b]",
};

export default function BillingPage() {
  const { user } = useAuth();

  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"info" | "error">("info");
  const [submitting, setSubmitting] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [batches, setBatches] = useState<CreditBatch[]>([]);
  const [claims, setClaims] = useState<PaymentClaim[]>([]);

  const [payMethod, setPayMethod] = useState<PaymentMethod>("gcash");
  const [buyKind, setBuyKind] = useState<"per_game" | "subscription">("per_game");
  const [buyScope, setBuyScope] = useState<AnnotationScope>("Single Team");
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [buyPackage, setBuyPackage] = useState<SubscriptionPackageKey>("rookie");
  const [referenceNumber, setReferenceNumber] = useState("");

  async function refresh() {
    if (!user) return;
    const [proj, creditBatches, myClaims] = await Promise.all([
      getProjects(user.id),
      getCreditBatches(user.id),
      getMyPaymentClaims(user.id),
    ]);
    setProjects(proj);
    setBatches(creditBatches);
    setClaims(myClaims);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function flashNotice(text: string, tone: "info" | "error" = "info") {
    setNotice(text);
    setNoticeTone(tone);
    setTimeout(() => setNotice(null), 6000);
  }

  const balance = useMemo(() => creditBalance(batches), [batches]);
  const pendingClaims = useMemo(() => claims.filter((c) => c.status !== "approved"), [claims]);

  const buyTotal =
    buyKind === "per_game" ? PER_GAME_PRICE_PHP[buyScope] * buyQuantity : SUBSCRIPTION_PACKAGES[buyPackage].pricePhp;

  async function handleSubmitClaim() {
    if (!user || referenceNumber.trim().length < 3) return;
    setSubmitting(true);
    const result = await submitPaymentClaim(user.id, {
      kind: buyKind,
      scope: buyKind === "per_game" ? buyScope : undefined,
      quantity: buyKind === "per_game" ? buyQuantity : undefined,
      package: buyKind === "subscription" ? buyPackage : undefined,
      amountPhp: buyTotal,
      paymentMethod: payMethod,
      referenceNumber: referenceNumber.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      flashNotice(result.error, "error");
      return;
    }
    setReferenceNumber("");
    flashNotice("Submitted — we'll confirm your payment and add your credits shortly.");
    await refresh();
  }

  if (!user) return null;

  return (
    <div>
      <p className="eyebrow mb-3">CLIENT PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Billing </span>
        <span className="text-gradient-orange">&amp; Credits.</span>
      </h1>
      <p className="mt-2 max-w-lg text-sm text-text-muted">
        Buy game credits one at a time, or as a package — each project you
        upload spends one credit matching its scope.
      </p>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div
              className="mt-6 rounded-md border px-4 py-3 font-mono-tech text-[0.68rem] leading-relaxed"
              style={
                noticeTone === "error"
                  ? { borderColor: "rgba(255,107,107,0.3)", background: "rgba(255,107,107,0.06)", color: "#ff9b9b" }
                  : { borderColor: "var(--border-orange)", background: "rgba(255,106,0,0.06)", color: "var(--orange-bright)" }
              }
            >
              {notice}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10">
        <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
          CREDIT BALANCE
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <StatTile label="SINGLE TEAM GAMES" value={balance["Single Team"]} />
          <StatTile label="BOTH TEAMS GAMES" value={balance["Both Teams"]} />
        </div>
        <p className="mt-3 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
          {projects.length} PROJECT{projects.length === 1 ? "" : "S"} UPLOADED TOTAL
        </p>
      </div>

      <div className="mt-8 rounded-md border border-border bg-surface-light px-4 py-3 font-mono-tech text-[0.6rem] leading-relaxed tracking-[0.02em] text-text-faint">
        All purchases below are final — game credits and packages are non-refundable once bought. See our{" "}
        <a href="/terms#subscriptions" className="text-orange-bright hover:text-orange">Terms of Service</a> for details.
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
          PAY VIA E-WALLET
        </h2>
        <div className="hs-panel sheen-top flex flex-col gap-5 p-5 sm:max-w-xl">
          <div className="flex gap-2">
            {(["per_game", "subscription"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setBuyKind(k)}
                className={`hs-chip transition-colors ${buyKind === k ? "!border-orange/50 !text-orange-bright" : "text-text-faint"}`}
              >
                {k === "per_game" ? "Per-game" : "Package"}
              </button>
            ))}
          </div>

          {buyKind === "per_game" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="buy-scope" className="hs-label">SCOPE</label>
                <select
                  id="buy-scope"
                  className="hs-input"
                  value={buyScope}
                  onChange={(e) => setBuyScope(e.target.value as AnnotationScope)}
                >
                  {SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {s} — {formatPhp(PER_GAME_PRICE_PHP[s])}/game
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="buy-quantity" className="hs-label">QUANTITY</label>
                <input
                  id="buy-quantity"
                  type="number"
                  min={1}
                  max={100}
                  className="hs-input"
                  value={buyQuantity}
                  onChange={(e) => setBuyQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="buy-package" className="hs-label">PACKAGE</label>
              <select
                id="buy-package"
                className="hs-input"
                value={buyPackage}
                onChange={(e) => setBuyPackage(e.target.value as SubscriptionPackageKey)}
              >
                {SUBSCRIPTION_PACKAGE_ORDER.map((key) => {
                  const info = SUBSCRIPTION_PACKAGES[key];
                  return (
                    <option key={key} value={key}>
                      {info.label} — {formatPhp(info.pricePhp)} ({info.singleTeamCredits} single / {info.bothTeamCredits} both, expires {info.expiresInMonths}mo)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="pay-method" className="hs-label">PAY WITH</label>
            <select
              id="pay-method"
              className="hs-input"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHOD_ORDER.map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface-light p-5 text-center">
            <img
              src={`/payment-qr/${payMethod}.png`}
              alt={`${PAYMENT_METHOD_LABELS[payMethod]} QR code`}
              className="h-48 w-48 rounded border border-border bg-white object-contain p-2"
            />
            <p className="font-mono-tech text-[0.62rem] tracking-[0.06em] text-text-faint">
              Scan with {PAYMENT_METHOD_LABELS[payMethod]} and pay <span className="text-text">{formatPhp(buyTotal)}</span>,
              then enter your payment reference number below.
            </p>
          </div>

          <div>
            <label htmlFor="reference-number" className="hs-label">PAYMENT REFERENCE NUMBER</label>
            <input
              id="reference-number"
              className="hs-input"
              placeholder="e.g. 1234567890123"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="font-mono-tech text-[0.62rem] tracking-[0.08em] text-text-faint">
              TOTAL: <span className="text-text">{formatPhp(buyTotal)}</span>
            </p>
            <button
              onClick={handleSubmitClaim}
              disabled={submitting || referenceNumber.trim().length < 3}
              className="hs-btn-primary disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? "SUBMITTING..." : "I'VE PAID — SUBMIT FOR REVIEW"}
            </button>
          </div>
        </div>
      </div>

      {pendingClaims.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
            YOUR PAYMENT CLAIMS
          </h2>
          <div className="hs-panel sheen-top flex flex-col divide-y divide-border p-0">
            {pendingClaims.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="text-sm text-text">
                    {c.kind === "per_game" ? `${c.quantity}× ${c.scope}` : SUBSCRIPTION_PACKAGES[c.package!].label}
                    {" — "}
                    {formatPhp(c.amountPhp)}
                  </p>
                  <p className="mt-1 font-mono-tech text-[0.58rem] tracking-[0.06em] text-text-faint">
                    {PAYMENT_METHOD_LABELS[c.paymentMethod]} · ref {c.referenceNumber} · {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                  {c.status === "rejected" && c.adminNote && (
                    <p className="mt-1 font-mono-tech text-[0.58rem] tracking-[0.06em] text-[#ff9b9b]">{c.adminNote}</p>
                  )}
                </div>
                <span className={`font-mono-tech text-[0.6rem] tracking-[0.1em] ${CLAIM_STATUS_STYLES[c.status]}`}>
                  {c.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 mb-2">
        <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
          PURCHASE HISTORY
        </h2>
        <div className="hs-panel sheen-top overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["DATE", "SOURCE", "SCOPE", "QUANTITY", "REMAINING", "EXPIRES"].map((h) => (
                    <th key={h} className="p-4 font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-text-faint">
                      No purchases yet.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} className="border-b border-border/60 last:border-0">
                      <td className="p-4 text-text-muted">
                        {new Date(b.createdAt).toLocaleDateString()}
                        {b.note && (
                          <p className="mt-1 font-mono-tech text-[0.56rem] tracking-[0.06em] text-text-faint">{b.note}</p>
                        )}
                      </td>
                      <td className="p-4 text-text">{sourceLabel(b.source)}</td>
                      <td className="p-4 text-text-muted">{b.scope}</td>
                      <td className="p-4 font-mono-tech text-text-muted">{b.quantityTotal}</td>
                      <td className="p-4 font-mono-tech text-orange-bright">{b.quantityRemaining}</td>
                      <td className="p-4 text-text-muted">
                        {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : "Never"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
