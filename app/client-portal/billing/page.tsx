"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { getProjects } from "@/lib/portal/store";
import type { Project } from "@/lib/portal/store";
import { getBilling, changePlan, downloadInvoice, PLANS } from "@/lib/portal/billing";
import type { PlanTier } from "@/lib/portal/billing";

const TIERS: PlanTier[] = ["Starter", "Pro", "Enterprise"];

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-light px-2.5 py-1 font-mono-tech text-[0.6rem] tracking-[0.12em] text-text-soft">
      <span className="h-1.5 w-1.5 rounded-full bg-orange" />
      PAID
    </span>
  );
}

function BillingPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"info" | "error">("info");
  const [checkoutLoading, setCheckoutLoading] = useState<PlanTier | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    if (!user) return;
    getProjects(user.id).then(setProjects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshKey]);

  const billing = useMemo(
    () => (user ? getBilling(user.id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, refreshKey]
  );

  function flashNotice(text: string, tone: "info" | "error" = "info") {
    setNotice(text);
    setNoticeTone(tone);
    setTimeout(() => setNotice(null), 5000);
  }

  // Handle the redirect back from Stripe Checkout. Reading this from a URL
  // query param (rather than a server-verified webhook) is the "not
  // production-safe" shortcut documented in app/api/checkout/route.ts —
  // fine for this demo, not for real revenue protection.
  //
  // processedCheckoutRef guards against double-processing: React's
  // StrictMode intentionally double-invokes effects in development,
  // which without this guard created two invoices for one redirect.
  // Billing code must be idempotent even when the trigger fires twice.
  const processedCheckoutRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkout = searchParams.get("checkout");
    if (!checkout) return;

    const requestKey = searchParams.toString();
    if (processedCheckoutRef.current === requestKey) return;
    processedCheckoutRef.current = requestKey;

    if (checkout === "success") {
      const tier = searchParams.get("tier") as PlanTier | null;
      if (tier && tier in PLANS) {
        changePlan(user.id, tier);
        setRefreshKey((k) => k + 1);
        flashNotice(
          `Payment received — plan updated to ${tier}. A real Stripe test charge was made; a matching invoice was added below.`
        );
      }
      router.replace("/client-portal/billing");
    } else if (checkout === "cancelled") {
      flashNotice("Checkout was cancelled — your plan was not changed.");
      router.replace("/client-portal/billing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  if (!user || !billing) return null;

  const plan = PLANS[billing.planTier];
  const usagePct = Math.min(100, Math.round((projects.length / plan.projectsIncluded) * 100));

  async function handleSwitchPlan(tier: PlanTier) {
    setCheckoutLoading(tier);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setCheckoutLoading(null);
      const message = err instanceof Error ? err.message : "Could not start checkout.";
      flashNotice(message, "error");
    }
  }

  function handleUpdatePayment() {
    flashNotice("Payment methods aren't connected to a real processor in this demo.");
  }

  return (
    <div>
      <p className="eyebrow mb-3">CLIENT PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Billing </span>
        <span className="text-gradient-orange">&amp; Plan.</span>
      </h1>
      <p className="mt-2 max-w-lg text-sm text-text-muted">
        Manage your subscription, payment method, and invoice history.
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
                  ? {
                      borderColor: "rgba(255,107,107,0.3)",
                      background: "rgba(255,107,107,0.06)",
                      color: "#ff9b9b",
                    }
                  : {
                      borderColor: "var(--border-orange)",
                      background: "rgba(255,106,0,0.06)",
                      color: "var(--orange-bright)",
                    }
              }
            >
              {notice}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="hs-panel sheen-top p-6">
          <div className="flex items-center justify-between">
            <span className="hs-chip">CURRENT PLAN</span>
            <span className="font-display text-2xl font-semibold text-orange-bright">
              ${plan.price}
              <span className="text-sm text-text-faint">/mo</span>
            </span>
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            {plan.tier}
          </h2>
          <p className="mt-1 font-mono-tech text-[0.62rem] tracking-[0.1em] text-text-faint">
            {plan.turnaround.toUpperCase()} TURNAROUND
          </p>

          <div className="mt-5">
            <div className="flex items-center justify-between font-mono-tech text-[0.62rem] tracking-[0.1em] text-text-faint">
              <span>PROJECTS USED</span>
              <span className="text-text">
                {projects.length} / {plan.projectsIncluded}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-light">
              <div
                className="h-full rounded-full"
                style={{ width: `${usagePct}%`, background: "var(--grad-orange)" }}
              />
            </div>
          </div>

          <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-5">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-text-muted">
                <span className="text-orange">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="hs-panel sheen-top p-6">
          <span className="hs-chip">PAYMENT METHOD</span>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-14 flex-none items-center justify-center rounded border border-border bg-surface-light font-mono-tech text-[0.58rem] tracking-[0.04em] text-text-soft">
              {billing.cardBrand.toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-text">•••• •••• •••• {billing.cardLast4}</p>
              <p className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                EXPIRES {billing.cardExpiry}
              </p>
            </div>
          </div>
          <button onClick={handleUpdatePayment} className="hs-btn-secondary mt-6 w-full">
            UPDATE PAYMENT METHOD
          </button>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
          AVAILABLE PLANS
        </h2>
        <p className="mb-4 font-mono-tech text-[0.62rem] leading-relaxed text-text-faint">
          Switching plans opens a real Stripe Checkout page (test mode). Use
          card number 4242 4242 4242 4242, any future expiry, any CVC.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TIERS.map((tier) => {
            const info = PLANS[tier];
            const isCurrent = tier === billing.planTier;
            const isLoading = checkoutLoading === tier;
            return (
              <div
                key={tier}
                className="hs-panel sheen-top flex flex-col p-6"
                style={isCurrent ? { borderColor: "var(--border-orange)" } : undefined}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">{tier}</h3>
                  {isCurrent && (
                    <span className="hs-chip !px-2.5 !py-1 !text-[0.56rem]">CURRENT</span>
                  )}
                </div>
                <p className="mt-2 font-display text-2xl font-semibold text-orange-bright">
                  ${info.price}
                  <span className="text-sm text-text-faint">/mo</span>
                </p>
                <ul className="mt-4 flex flex-1 flex-col gap-2">
                  {info.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-text-muted">
                      <span className="mt-0.5 flex-none text-orange">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSwitchPlan(tier)}
                  disabled={isCurrent || checkoutLoading !== null}
                  className={`mt-6 w-full ${
                    isCurrent ? "hs-btn-secondary opacity-50" : "hs-btn-primary"
                  } disabled:cursor-wait disabled:opacity-70`}
                >
                  {isCurrent
                    ? "CURRENT PLAN"
                    : isLoading
                      ? "REDIRECTING TO STRIPE..."
                      : `SWITCH TO ${tier.toUpperCase()}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10 mb-2">
        <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
          BILLING HISTORY
        </h2>
        <div className="hs-panel sheen-top overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["DATE", "PLAN", "AMOUNT", "STATUS", ""].map((h) => (
                    <th
                      key={h}
                      className="p-4 font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {billing.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/60 last:border-0">
                    <td className="p-4 text-text-muted">
                      {new Date(inv.date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-text">{inv.planTier}</td>
                    <td className="p-4 font-mono-tech text-orange-bright">
                      ${inv.amount.toFixed(2)}
                    </td>
                    <td className="p-4">
                      <StatusBadge />
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => downloadInvoice(inv, user.name)}
                        className="font-mono-tech text-[0.62rem] tracking-[0.1em] text-orange-bright transition-colors hover:text-orange"
                      >
                        DOWNLOAD
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingPageContent />
    </Suspense>
  );
}
