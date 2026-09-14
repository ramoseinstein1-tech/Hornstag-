"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/types";
import AnnotatorPortalSidebar from "./AnnotatorPortalSidebar";

const SIDEBAR_COLLAPSE_KEY = "hornstag_sidebar_collapsed";

export default function AnnotatorPortalShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    } catch {
      // Blocked storage — default to expanded.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — worst case the preference doesn't persist.
      }
      return next;
    });
  }

  return (
    <div
      className={`relative min-h-[100svh] bg-background lg:grid lg:transition-[grid-template-columns] lg:duration-300 ${
        collapsed ? "lg:grid-cols-[0px_1fr]" : "lg:grid-cols-[260px_1fr]"
      }`}
    >
      <AnnotatorPortalSidebar
        user={user}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
      />

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
        className={`fixed top-1/2 z-40 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text-muted shadow-md transition-all duration-300 hover:border-orange/40 hover:text-orange-bright lg:flex ${
          collapsed ? "left-2" : "left-[244px]"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          {collapsed ? <path d="M9 5l7 7-7 7" /> : <path d="M15 5l-7 7 7 7" />}
        </svg>
      </button>

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
