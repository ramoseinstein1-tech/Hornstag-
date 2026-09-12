import type { Metadata } from "next";
import ComingSoonPanel from "@/components/client-portal/ComingSoonPanel";

export const metadata: Metadata = { title: "Billing — Hornstag Client Portal" };

export default function BillingPage() {
  return (
    <ComingSoonPanel
      title="Billing"
      description="Manage your subscription, view invoices, and update your payment method."
    />
  );
}
