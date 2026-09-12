/**
 * MOCK, CLIENT-SIDE BILLING STORE
 * ─────────────────────────────────────────────────────────────────
 * Same story as the other lib/portal and lib/auth stores — no backend,
 * no real payment processor. Plan changes and "payments" here just
 * update localStorage; no card is ever charged. Replace with a real
 * billing provider (Stripe, etc.) before this handles real money.
 */

export type PlanTier = "Starter" | "Pro" | "Enterprise";

export type PlanInfo = {
  tier: PlanTier;
  price: number;
  projectsIncluded: number;
  turnaround: string;
  features: string[];
};

export type Invoice = {
  id: string;
  date: string;
  amount: number;
  status: "Paid";
  planTier: PlanTier;
};

export type BillingData = {
  planTier: PlanTier;
  cardBrand: string;
  cardLast4: string;
  cardExpiry: string;
  invoices: Invoice[];
};

export const PLANS: Record<PlanTier, PlanInfo> = {
  Starter: {
    tier: "Starter",
    price: 149,
    projectsIncluded: 3,
    turnaround: "5–7 business days",
    features: [
      "3 projects / month",
      "Standard annotation",
      "CSV exports",
      "Email support",
    ],
  },
  Pro: {
    tier: "Pro",
    price: 399,
    projectsIncluded: 10,
    turnaround: "2–3 business days",
    features: [
      "10 projects / month",
      "Priority annotation queue",
      "Dedicated QA reviewer",
      "CSV exports",
      "Priority support",
    ],
  },
  Enterprise: {
    tier: "Enterprise",
    price: 999,
    projectsIncluded: 30,
    turnaround: "24–48 hours",
    features: [
      "30+ projects / month",
      "Rush annotation available",
      "Dedicated account manager",
      "Custom integrations",
      "SLA-backed support",
    ],
  },
};

const KEY_PREFIX = "hornstag_billing_";

function isBrowser() {
  return typeof window !== "undefined";
}

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function seedBilling(): BillingData {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

  return {
    planTier: "Pro",
    cardBrand: "Visa",
    cardLast4: "4242",
    cardExpiry: "12/27",
    invoices: [
      { id: "inv-1", date: daysAgo(2), amount: 399, status: "Paid", planTier: "Pro" },
      { id: "inv-2", date: daysAgo(32), amount: 399, status: "Paid", planTier: "Pro" },
      { id: "inv-3", date: daysAgo(62), amount: 149, status: "Paid", planTier: "Starter" },
    ],
  };
}

function isValidShape(data: unknown): data is BillingData {
  if (!data || typeof data !== "object") return false;
  const d = data as BillingData;
  return (
    typeof d.planTier === "string" &&
    typeof d.cardLast4 === "string" &&
    Array.isArray(d.invoices)
  );
}

function readBilling(userId: string): BillingData {
  if (!isBrowser()) return seedBilling();
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidShape(parsed)) return parsed;
    }
  } catch {
    // Corrupt data — fall through and reseed.
  }
  const seeded = seedBilling();
  writeBilling(userId, seeded);
  return seeded;
}

function writeBilling(userId: string, data: BillingData) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key(userId), JSON.stringify(data));
}

export function getBilling(userId: string): BillingData {
  return readBilling(userId);
}

export function changePlan(userId: string, tier: PlanTier): BillingData {
  const data = readBilling(userId);
  data.planTier = tier;
  data.invoices = [
    {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      amount: PLANS[tier].price,
      status: "Paid",
      planTier: tier,
    },
    ...data.invoices,
  ];
  writeBilling(userId, data);
  return data;
}

export function downloadInvoice(invoice: Invoice, billedTo: string) {
  if (!isBrowser()) return;
  const lines = [
    "HORNSTAG — INVOICE RECEIPT",
    "================================",
    `Invoice ID: ${invoice.id}`,
    `Billed to: ${billedTo}`,
    `Date: ${new Date(invoice.date).toLocaleDateString()}`,
    `Plan: ${invoice.planTier}`,
    `Amount: $${invoice.amount.toFixed(2)}`,
    `Status: ${invoice.status}`,
    "================================",
    "This is a mock receipt generated for demo purposes — no real",
    "payment was processed.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hornstag_invoice_${invoice.id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
