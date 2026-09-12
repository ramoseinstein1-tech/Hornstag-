import type { Metadata } from "next";
import ClientPortalGuard from "@/components/client-portal/ClientPortalGuard";

export const metadata: Metadata = {
  title: "Client Portal — Hornstag",
  description:
    "Manage your basketball annotation projects, results, and account.",
};

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientPortalGuard>{children}</ClientPortalGuard>;
}
