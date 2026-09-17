"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function BillingPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"info" | "error">("info");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [batches, setBatches] = useState<CreditBatch[]>([]);

  const [buyScope, setBuyScope] = useState<AnnotationScope>("Single Team");
  const [buyQuantity, setBuyQuantity] = useState(1);

  async function refresh() {
    if (!user) return;
    const [proj, creditBatches] = await Promise.all([getProjects(user.id), getCreditBatches(user.id)]);
    setProjects(proj);
    setBatches(creditBatches);
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

  // Handle the redirect back from Stripe Checkout. Unlike the old flow,
  // this NEVER grants anything itself — credits are already recorded by
  // the time this fires, via app/api/webhooks/stripe/route.ts verifying
  // the payment server-side. This just shows a notice and refetches.
  const processedCheckoutRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkout = searchParams.get("checkout");
    if (!checkout) return;

    const requestKey = searchParams.toString();
    if (processedCheckoutRef.current === requestKey) return;
    processedCheckoutRef.current = requestKey;

    if (checkout === "success") {
      flashNotice("Payment received — your credits will appear below shortly.");
      refresh();
    } else if (checkout === "cancelled") {
      flashNotice("Checkout was cancelled — nothing was charged.");
    }
    router.replace("/client-portal/billing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  const balance = useMemo(() => creditBalance(batches), [batches]);

  async function startCheckout(key: string, body: object) {
    setCheckoutLoading(key);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  function handleBuyGames() {
    startCheckout("per_game", { kind: "per_game", scope: buyScope, quantity: buyQuantity });
  }

  function handleBuyPackage(key: SubscriptionPackageKey) {
    startCheckout(key, { kind: "subscription", package: key });
  }

  if (!user) return null;

  const buyTotal = PER_GAME_PRICE_PHP[buyScope] * buyQuantity;

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

      <div className="mt-10">
        <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
          BUY GAMES
        </h2>
        <div className="hs-panel sheen-top flex flex-col gap-4 p-5 sm:max-w-xl">
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
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="font-mono-tech text-[0.62rem] tracking-[0.08em] text-text-faint">
              TOTAL: <span className="text-text">{formatPhp(buyTotal)}</span>
            </p>
            <button
              onClick={handleBuyGames}
              disabled={checkoutLoading !== null}
              className="hs-btn-primary disabled:cursor-wait disabled:opacity-70"
            >
              {checkoutLoading === "per_game" ? "REDIRECTING TO STRIPE..." : "BUY"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
          SUBSCRIPTION PACKAGES
        </h2>
        <p className="mb-4 font-mono-tech text-[0.62rem] leading-relaxed text-text-faint">
          A one-time bundle purchase — credits don&rsquo;t renew monthly, they
          last until you use them all or they expire.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SUBSCRIPTION_PACKAGE_ORDER.map((key) => {
            const info = SUBSCRIPTION_PACKAGES[key];
            const isLoading = checkoutLoading === key;
            return (
              <div key={key} className="hs-panel sheen-top flex flex-col p-6">
                <h3 className="font-display text-lg font-semibold">{info.label}</h3>
                <p className="mt-2 font-display text-2xl font-semibold text-orange-bright">
                  {formatPhp(info.pricePhp)}
                </p>
                <ul className="mt-4 flex flex-1 flex-col gap-2">
                  {info.singleTeamCredits > 0 && (
                    <li className="flex items-start gap-2 text-xs text-text-muted">
                      <span className="mt-0.5 flex-none text-orange">✓</span>
                      {info.singleTeamCredits} Single Team games
                    </li>
                  )}
                  {info.bothTeamCredits > 0 && (
                    <li className="flex items-start gap-2 text-xs text-text-muted">
                      <span className="mt-0.5 flex-none text-orange">✓</span>
                      {info.bothTeamCredits} Both Teams games
                    </li>
                  )}
                  <li className="flex items-start gap-2 text-xs text-text-faint">
                    <span className="mt-0.5 flex-none text-orange">✓</span>
                    Expires {info.expiresInMonths} months after purchase
                  </li>
                </ul>
                <button
                  onClick={() => handleBuyPackage(key)}
                  disabled={checkoutLoading !== null}
                  className="hs-btn-primary mt-6 w-full disabled:cursor-wait disabled:opacity-70"
                >
                  {isLoading ? "REDIRECTING TO STRIPE..." : "BUY"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

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
                      <td className="p-4 text-text-muted">{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-text">{b.source === "per_game" ? "Per-game" : SUBSCRIPTION_PACKAGES[b.source as SubscriptionPackageKey]?.label ?? b.source}</td>
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

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingPageContent />
    </Suspense>
  );
}
