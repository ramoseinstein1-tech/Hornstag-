"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/types";
import PortalSidebar from "./PortalSidebar";

export default function PortalShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative min-h-[100svh] bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <PortalSidebar
        user={user}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex min-h-[100svh] flex-col">
        <header className="sticky top-0 z-30 flex h-16 flex-none items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur-md lg:hidden">
          <span className="font-display text-lg font-bold tracking-tight text-orange">
            HORNSTAG
          </span>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 flex-col items-center justify-center gap-1.5"
          >
            <span className="h-px w-5 bg-text" />
            <span className="h-px w-5 bg-text" />
          </button>
        </header>

        <main className="flex-1 px-6 py-10 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
