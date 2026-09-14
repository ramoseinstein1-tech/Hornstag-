import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { ROLE_HOME, type UserRole } from "@/lib/auth/types";

const AUTH_ROUTES = [
  "/signin",
  "/signup",
  "/annotator-signin",
  "/annotator-signup",
  "/admin-signin",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  if (authUser) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).single();
    role = (profile?.role as UserRole) ?? null;
  }

  const isClientPortalRoute = pathname.startsWith("/client-portal");
  const isAnnotatorPortalRoute = pathname.startsWith("/annotator-portal");
  const isAdminPortalRoute = pathname.startsWith("/admin-portal");
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Unauthenticated users can't reach the client portal.
  if (isClientPortalRoute && !authUser) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Unauthenticated users can't reach the annotator portal either — sent to
  // its own sign-in, not the client one.
  if (isAnnotatorPortalRoute && !authUser) {
    const signInUrl = new URL("/annotator-signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Same for the admin portal. Note /admin-bootstrap is deliberately NOT
  // gated here — it must work before any session exists.
  if (isAdminPortalRoute && !authUser) {
    const signInUrl = new URL("/admin-signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Already-signed-in users don't need any sign-in/sign-up form.
  if (isAuthRoute && authUser && role) {
    const home = ROLE_HOME[role] ?? "/client-portal";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
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
