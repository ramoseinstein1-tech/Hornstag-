import type { ReactNode } from "react";
import AdminPortalGuard from "@/components/admin-portal/AdminPortalGuard";

export default function AdminPortalLayout({ children }: { children: ReactNode }) {
  return <AdminPortalGuard>{children}</AdminPortalGuard>;
}
