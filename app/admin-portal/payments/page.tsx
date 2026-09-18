"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPendingPaymentClaims,
  approvePaymentClaim,
  rejectPaymentClaim,
  PAYMENT_METHOD_LABELS,
  type PaymentClaim,
} from "@/lib/portal/paymentClaims";
import { SUBSCRIPTION_PACKAGES } from "@/lib/portal/billing";

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

function describeClaim(claim: PaymentClaim): string {
  if (claim.kind === "per_game") {
    return `${claim.quantity}× ${claim.scope} game${claim.quantity === 1 ? "" : "s"}`;
  }
  const info = claim.package ? SUBSCRIPTION_PACKAGES[claim.package] : undefined;
  return info ? `${info.label} package` : "Package";
}

export default function AdminPaymentsPage() {
  const [claims, setClaims] = useState<PaymentClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentClaim | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setClaims(await getPendingPaymentClaims());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(claim: PaymentClaim) {
    setError(null);
    setBusyId(claim.id);
    const result = await approvePaymentClaim(claim.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await load();
  }

  async function handleReject() {
    if (!rejectTarget || rejectNote.trim().length < 3) return;
    setError(null);
    setBusyId(rejectTarget.id);
    const result = await rejectPaymentClaim(rejectTarget.id, rejectNote);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRejectTarget(null);
    setRejectNote("");
    await load();
  }

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Payments.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Pending e-wallet payment claims — check your own wallet app for the reference number before approving.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] px-4 py-3 font-mono-tech text-[0.68rem] leading-relaxed text-[#ff9b9b]">
          {error}
        </div>
      )}

      <div className="mt-6 hs-panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">CLIENT</th>
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">ITEM</th>
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">AMOUNT</th>
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">WALLET</th>
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">REFERENCE #</th>
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">SUBMITTED</th>
                <th className="px-5 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-faint">Loading…</td>
                </tr>
              )}
              {!loading && claims.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-faint">No pending payment claims.</td>
                </tr>
              )}
              {!loading &&
                claims.map((claim) => (
                  <tr key={claim.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <p className="text-text">{claim.ownerName}</p>
                      <p className="mt-0.5 font-mono-tech text-[0.58rem] tracking-[0.04em] text-text-faint">{claim.ownerEmail}</p>
                    </td>
                    <td className="px-3 py-3 text-text-muted">{describeClaim(claim)}</td>
                    <td className="px-3 py-3 font-mono-tech text-orange-bright">{formatPhp(claim.amountPhp)}</td>
                    <td className="px-3 py-3 text-text-muted">{PAYMENT_METHOD_LABELS[claim.paymentMethod]}</td>
                    <td className="px-3 py-3 font-mono-tech text-text-muted">{claim.referenceNumber}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-text-muted">{new Date(claim.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-4">
                        <button
                          type="button"
                          disabled={busyId === claim.id}
                          onClick={() => handleApprove(claim)}
                          className="font-mono-tech text-[0.6rem] tracking-[0.08em] text-[#7cd48a] transition-colors hover:text-[#9ee6ac] disabled:cursor-wait disabled:opacity-50"
                        >
                          APPROVE
                        </button>
                        <button
                          type="button"
                          disabled={busyId === claim.id}
                          onClick={() => {
                            setRejectTarget(claim);
                            setRejectNote("");
                          }}
                          className="font-mono-tech text-[0.6rem] tracking-[0.08em] text-[#ff9b9b] transition-colors hover:text-[#ff6b6b] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          REJECT
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="hs-panel w-full max-w-md p-6" style={{ borderColor: "rgba(255,107,107,0.25)" }}>
            <h2 className="mb-2 font-mono-tech text-[0.66rem] tracking-[0.2em] text-[#ff9b9b]">REJECT PAYMENT CLAIM</h2>
            <p className="mb-4 text-sm leading-relaxed text-text-muted">
              Rejecting <span className="text-text">{rejectTarget.ownerName}</span>&rsquo;s claim for{" "}
              {describeClaim(rejectTarget)} ({formatPhp(rejectTarget.amountPhp)}). No credits will be granted.
            </p>
            <textarea
              className="hs-input min-h-[80px] resize-y"
              placeholder="Reason (e.g. reference number doesn't match any received payment)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setRejectTarget(null)} className="hs-btn-ghost">
                CANCEL
              </button>
              <button
                onClick={handleReject}
                disabled={rejectNote.trim().length < 3}
                className="rounded-md border px-4 py-2.5 font-mono-tech text-[0.7rem] tracking-[0.1em] text-[#ff9b9b] transition-colors hover:bg-[#ff6b6b]/10 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: "rgba(255,107,107,0.4)" }}
              >
                REJECT CLAIM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
