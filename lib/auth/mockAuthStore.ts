import { SESSION_COOKIE, type SessionUser, type UserRole } from "./types";

/**
 * MOCK, CLIENT-SIDE AUTH STORE
 * ─────────────────────────────────────────────────────────────────
 * Hornstag doesn't have a real backend or database yet — the project
 * has no server framework, ORM, or auth library installed. This module
 * simulates one entirely in the browser (localStorage) so the sign-up /
 * sign-in flow, protected routes, and session persistence all work
 * end-to-end today.
 *
 * Before this handles real user data, replace it with actual server-side
 * API routes backed by a real database, passwords hashed with bcrypt/
 * argon2 (with a per-user salt, done server-side), and an httpOnly,
 * server-signed session cookie. Everything in this file is readable and
 * editable by anyone with devtools open — it is a functional stand-in,
 * not a security boundary.
 */

const USERS_KEY = "hornstag_mock_users";
const SESSION_STORAGE_KEY = "hornstag_session";

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
  createdAt: string;
};

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

function isBrowser() {
  return typeof window !== "undefined";
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function getUsers(): StoredUser[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toSessionUser(u: StoredUser): SessionUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

function writeSessionCookie(user: SessionUser | null, persist: boolean) {
  if (!isBrowser()) return;
  if (!user) {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return;
  }
  const value = encodeURIComponent(JSON.stringify(user));
  const maxAge = persist ? `; max-age=${60 * 60 * 24 * 30}` : "";
  document.cookie = `${SESSION_COOKIE}=${value}; path=/${maxAge}; samesite=lax`;
}

/** Persists the session so it survives a refresh. `persist` mirrors the
 * "remember me" checkbox: true -> localStorage (survives closing the
 * browser), false -> sessionStorage (cleared when the tab closes). Either
 * way a matching cookie is written so `middleware.ts` can gate routes. */
export function setSession(user: SessionUser, persist: boolean) {
  if (!isBrowser()) return;
  const value = JSON.stringify(user);
  if (persist) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, value);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, value);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  writeSessionCookie(user, persist);
}

export function getSession(): SessionUser | null {
  if (!isBrowser()) return null;
  try {
    const fromLocal = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (fromLocal) return JSON.parse(fromLocal) as SessionUser;
    const fromSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (fromSession) return JSON.parse(fromSession) as SessionUser;
  } catch {
    // Corrupt/blocked storage — treat as signed out.
  }
  return null;
}

export function clearSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  writeSessionCookie(null, false);
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const users = getUsers();

  if (users.some((u) => u.email === email)) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(input.password, salt);

  // New public sign-ups are always provisioned as "client" for now — see
  // ROLE_HOME in ./types for how Annotator/Admin would plug in later.
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    role: "client",
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  saveUsers([...users, user]);
  return { ok: true, user: toSessionUser(user) };
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const user = getUsers().find((u) => u.email === email);

  if (!user) {
    return { ok: false, error: "No account found with that email." };
  }

  const hash = await hashPassword(input.password, user.salt);
  if (hash !== user.passwordHash) {
    return { ok: false, error: "Incorrect password." };
  }

  return { ok: true, user: toSessionUser(user) };
}
