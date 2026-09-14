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

/** Where each role lands after signing in. Only "client" and "annotator"
 * are built today — admin is reserved so an Admin dashboard can be dropped
 * in later without touching the redirect logic. */
export const ROLE_HOME: Record<UserRole, string> = {
  client: "/client-portal",
  annotator: "/annotator-portal",
  admin: "/admin-portal", // not yet built
};

/** Where each role's sign-in form lives — a separate portal per role, not
 * one shared /signin. Mirrors ROLE_HOME. */
export const ROLE_SIGNIN: Record<UserRole, string> = {
  client: "/signin",
  annotator: "/annotator-signin",
  admin: "/admin-signin", // not yet built
};

export const SESSION_COOKIE = "hornstag_session";
