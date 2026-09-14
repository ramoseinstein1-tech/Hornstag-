"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import type { SessionUser } from "@/lib/auth/types";

const ICONS = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </>
  ),
  folder: <path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h4.4l1.8 2h6.8A1.5 1.5 0 0 1 19 8.5v9A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5v-11Z" />,
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="M7 8.5 12 4l5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V9" />
      <path d="M11 19V4" />
      <path d="M18 19v-6" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.8" />
      <path d="M3 10h18" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5M18.4 18.4l-1.5-1.5M7.1 7.1 5.6 5.6" />
    </>
  ),
};

function NavIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] flex-none"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const NAV: { label: string; href: string; exact?: boolean; icon: keyof typeof ICONS }[] = [
  { label: "Dashboard", href: "/client-portal", exact: true, icon: "grid" },
  { label: "Projects", href: "/client-portal/projects", icon: "folder" },
  { label: "Upload Project", href: "/client-portal/upload", icon: "upload" },
  { label: "Results", href: "/client-portal/results", icon: "chart" },
  { label: "Billing", href: "/client-portal/billing", icon: "card" },
  { label: "Account Settings", href: "/client-portal/settings", icon: "gear" },
];

function SidebarContent({
  user,
  onNavigate,
}: {
  user: SessionUser;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center border-b border-border px-6">
        <Link
          href="/client-portal"
          onClick={onNavigate}
          className="flex items-center"
          aria-label="Hornstag client portal home"
        >
          <Image
            src="/hornstag-wordmark.png"
            alt="Hornstag"
            width={1528}
            height={638}
            className="h-7 w-auto"
          />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Client portal">
        <ul className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm transition-all duration-300 ${
                    active
                      ? "bg-orange/10 text-orange-bright"
                      : "text-text-muted hover:bg-surface-light hover:text-text"
                  }`}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface/60 px-3.5 py-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-orange-bright to-orange-deep font-display text-sm font-semibold text-background">
            {user.name.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{user.name}</p>
            <p className="font-mono-tech text-[0.6rem] tracking-[0.14em] text-text-faint">
              {user.role.toUpperCase()}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border py-2.5 font-mono-tech text-[0.66rem] tracking-[0.14em] text-text-muted transition-colors duration-300 hover:border-orange/40 hover:text-orange-bright"
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
}

export default function PortalSidebar({
  user,
  mobileOpen,
  onClose,
  collapsed,
}: {
  user: SessionUser;
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
}) {
  return (
    <>
      <aside
        className={`hidden overflow-hidden bg-surface lg:block ${
          collapsed ? "border-r-0" : "border-r border-border"
        }`}
      >
        <div className="w-[260px]">
          <SidebarContent user={user} onNavigate={onClose} />
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              aria-hidden="true"
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-surface lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <SidebarContent user={user} onNavigate={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
