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

const AUTH_ROUTES = [
  "/signin",
  "/signup",
  "/annotator-signin",
  "/annotator-signup",
  "/admin-signin",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSession(request);

  const isClientPortalRoute = pathname.startsWith("/client-portal");
  const isAnnotatorPortalRoute = pathname.startsWith("/annotator-portal");
  const isAdminPortalRoute = pathname.startsWith("/admin-portal");
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Unauthenticated users can't reach the client portal.
  if (isClientPortalRoute && !session) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Unauthenticated users can't reach the annotator portal either — sent to
  // its own sign-in, not the client one.
  if (isAnnotatorPortalRoute && !session) {
    const signInUrl = new URL("/annotator-signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Same for the admin portal. Note /admin-bootstrap is deliberately NOT
  // gated here — it must work before any session exists.
  if (isAdminPortalRoute && !session) {
    const signInUrl = new URL("/admin-signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Already-signed-in users don't need any sign-in/sign-up form.
  if (isAuthRoute && session) {
    const home = ROLE_HOME[session.role] ?? "/client-portal";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/client-portal/:path*",
    "/signin",
    "/signup",
    "/annotator-portal/:path*",
    "/annotator-signin",
    "/annotator-signup",
    "/admin-portal/:path*",
    "/admin-signin",
  ],
};
