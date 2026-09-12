"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import PortalShell from "./PortalShell";

/**
 * Client-side guard for everything under /client-portal.
 *
 * `middleware.ts` already blocks unauthenticated requests to this route at
 * the edge, but that only covers the initial request. This guard is the
 * belt-and-suspenders layer for client-side navigations, and it's also
 * what drives the loading state while auth is being checked and hands the
 * signed-in user down to the sidebar/dashboard.
 */
export default function ClientPortalGuard({
  children,
}: {
  children: ReactNode;
}) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/signin?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-background">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-orange" />
        <p className="font-mono-tech text-[0.68rem] tracking-[0.2em] text-text-faint">
          LOADING WORKSPACE...
        </p>
      </div>
    );
  }

  // Unauthenticated: render nothing while the redirect above kicks in, so
  // portal content never flashes on screen.
  if (status === "unauthenticated" || !user) {
    return null;
  }

  return <PortalShell user={user}>{children}</PortalShell>;
}
