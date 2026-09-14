"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminPortalShell from "./AdminPortalShell";

/**
 * Client-side guard for everything under /admin-portal. Mirrors
 * AnnotatorPortalGuard/ClientPortalGuard — kept as a separate copy rather
 * than a shared, parameterized guard so the other two working portals
 * can't regress if this one changes.
 */
export default function AdminPortalGuard({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/admin-signin?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-background">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-orange" />
        <p className="font-mono-tech text-[0.68rem] tracking-[0.2em] text-text-faint">
          LOADING CONSOLE...
        </p>
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return null;
  }

  return <AdminPortalShell user={user}>{children}</AdminPortalShell>;
}
