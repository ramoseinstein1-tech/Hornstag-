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
import { getSession, clearSession } from "@/lib/auth/supabaseAuth";
import { createClient } from "@/lib/supabase/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: SessionUser | null;
  status: AuthStatus;
  /** Re-reads the session from Supabase — call after a profile change so
   * every consumer (sidebar, dashboard, etc.) updates without a full
   * reload. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const router = useRouter();

  const refresh = useCallback(async () => {
    const session = await getSession();
    setUser(session);
    setStatus(session ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    refresh();

    // Keep auth state in sync with Supabase's own session lifecycle
    // (token refresh, sign-out in another tab, etc.), not just on mount.
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const target = user ? (ROLE_SIGNIN[user.role] ?? "/signin") : "/signin";
    await clearSession();
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
