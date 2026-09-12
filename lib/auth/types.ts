/**
 * Shared auth types and constants.
 *
 * This file has zero browser-only APIs (no localStorage/document/crypto) so
 * it is safe to import from both client components AND `middleware.ts`,
 * which runs in the Edge runtime and has no DOM.
 */

export type UserRole = "client" | "annotator" | "admin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

/** Where each role lands after signing in. Only "client" is built today —
 * the other two are reserved so Annotator/Admin dashboards can be dropped
 * in later without touching the redirect logic. */
export const ROLE_HOME: Record<UserRole, string> = {
  client: "/client-portal",
  annotator: "/annotator-portal", // not yet built
  admin: "/admin-portal", // not yet built
};

export const SESSION_COOKIE = "hornstag_session";
