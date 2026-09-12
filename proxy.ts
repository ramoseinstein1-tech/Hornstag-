import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, ROLE_HOME, type SessionUser } from "@/lib/auth/types";

function readSession(request: NextRequest): SessionUser | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed && typeof parsed.role === "string") {
      return parsed as SessionUser;
    }
  } catch {
    // Malformed cookie — treat as signed out.
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSession(request);

  const isPortalRoute = pathname.startsWith("/client-portal");
  const isAuthRoute = pathname === "/signin" || pathname === "/signup";

  // Unauthenticated users can't reach the client portal.
  if (isPortalRoute && !session) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Already-signed-in users don't need the sign-in/sign-up forms.
  if (isAuthRoute && session) {
    const home = ROLE_HOME[session.role] ?? "/client-portal";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/client-portal/:path*", "/signin", "/signup"],
};
