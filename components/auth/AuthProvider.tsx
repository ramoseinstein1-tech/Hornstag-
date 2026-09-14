"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ROLE_SIGNIN, type SessionUser } from "@/lib/auth/types";
import { getSession, clearSession } from "@/lib/auth/mockAuthStore";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: SessionUser | null;
  status: AuthStatus;
  /** Re-reads the session from storage — call after setSession() so every
   * consumer (sidebar, dashboard, etc.) updates without a full reload. */
  refresh: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const router = useRouter();

  const refresh = useCallback(() => {
    const session = getSession();
    setUser(session);
    setStatus(session ? "authenticated" : "unauthenticated");
  }, []);

  // Runs once on mount (and on every full page load / refresh) to hydrate
  // auth state from storage — this is the "checking authentication" beat
  // protected routes wait on before deciding to render or redirect.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(() => {
    const target = user ? (ROLE_SIGNIN[user.role] ?? "/signin") : "/signin";
    clearSession();
    setUser(null);
    setStatus("unauthenticated");
    router.push(target);
  }, [router, user]);

  return (
    <AuthContext.Provider value={{ user, status, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return ctx;
}
