import { createClient } from "@/lib/supabase/client";
import type { SessionUser, UserRole } from "./types";

/**
 * REAL AUTH — backed by Supabase Auth + the `profiles` table.
 * Replaces the old lib/auth/mockAuthStore.ts localStorage mock.
 *
 * Role is NEVER trusted from client input at signup — every new account
 * is created as "client" by a database trigger (see
 * supabase/migrations/00000000000000_init.sql's handle_new_user()), and
 * can only change afterward via the security-definer RPCs
 * accept_annotator_invite / bootstrap_admin_if_none_exists, or an admin
 * using update_user_role. This file just calls those, it doesn't decide
 * who gets which role.
 */

export type AuthResult = { ok: true; user: SessionUser } | { ok: false; error: string };

function friendlyAuthError(message: string): string {
  if (message.toLowerCase().includes("already registered")) {
    return "An account with this email already exists.";
  }
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  return message;
}

async function toSessionUser(userId: string): Promise<SessionUser | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as SessionUser;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = createClient();
  const email = input.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });

  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  if (!data.user) return { ok: false, error: "Something went wrong creating your account." };

  const user = await toSessionUser(data.user.id);
  if (!user) return { ok: false, error: "Account created, but couldn't load your profile. Try signing in." };

  return { ok: true, user };
}

/** Annotator signup: creates the account, then immediately tries to
 * redeem an admin-issued invite for this email. If there's no unused
 * invite, the account still exists (as "client") but signup is reported
 * as failed with a clear message — matching the old mock's "reject
 * signup outright" behavior as closely as a two-step real flow allows. */
export async function registerAnnotator(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = createClient();
  const email = input.email.trim().toLowerCase();

  const signupResult = await registerUser(input);
  if (!signupResult.ok) return signupResult;

  const { data: accepted, error } = await supabase.rpc("accept_annotator_invite", {
    target_user_id: signupResult.user.id,
    invite_email: email,
  });

  if (error || !accepted) {
    return {
      ok: false,
      error: "You haven't been invited yet — ask an admin to invite your email address first.",
    };
  }

  const user = await toSessionUser(signupResult.user.id);
  return user ? { ok: true, user } : { ok: false, error: "Invite accepted, but couldn't load your profile." };
}

/** Admin bootstrap: creates the account, then tries the atomic
 * "first admin" RPC. Fails loudly if an admin already exists. */
export async function registerFirstAdmin(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = createClient();

  const signupResult = await registerUser(input);
  if (!signupResult.ok) return signupResult;

  const { data: granted, error } = await supabase.rpc("bootstrap_admin_if_none_exists", {
    target_user_id: signupResult.user.id,
  });

  if (error || !granted) {
    return { ok: false, error: "An admin account already exists." };
  }

  const user = await toSessionUser(signupResult.user.id);
  return user ? { ok: true, user } : { ok: false, error: "Admin granted, but couldn't load your profile." };
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  if (!data.user) return { ok: false, error: "Something went wrong signing in." };

  const user = await toSessionUser(data.user.id);
  return user ? { ok: true, user } : { ok: false, error: "Signed in, but couldn't load your profile." };
}

export async function getSession(): Promise<SessionUser | null> {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  return toSessionUser(authUser.id);
}

export async function clearSession(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function updateProfileName(userId: string, name: string): Promise<AuthResult> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "Enter your full name." };

  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ name: trimmed }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  const user = await toSessionUser(userId);
  return user ? { ok: true, user } : { ok: false, error: "Updated, but couldn't reload your profile." };
}

export async function changePassword(
  _userId: string,
  input: { currentPassword: string; newPassword: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();

  // Supabase has no "verify current password" call — re-authenticate with
  // it instead, which fails the same way an incorrect current password
  // would in the old mock.
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) return { ok: false, error: "Account not found." };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: authUser.email,
    password: input.currentPassword,
  });
  if (reauthError) return { ok: false, error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/** Deletes the CALLER's own account (self-service, from Settings — the
 * anon key can't delete other users' auth.users rows, only the service
 * role key can, so admin-initiated deletion of someone ELSE's account
 * goes through /api/admin/delete-user instead, see AdminUsersPage). */
export async function deleteOwnAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/account/delete", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? "Couldn't delete your account." };
  }
  return { ok: true };
}

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export async function listAllUsers(): Promise<AdminUserSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role as UserRole, createdAt: u.created_at }));
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Admin-only: permanently deletes ANOTHER user's account. Requires the
 * service role key, so it goes through a server route, not the browser
 * client — see app/api/admin/delete-user/route.ts. */
export async function deleteUserAsAdmin(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/admin/delete-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? "Couldn't delete that account." };
  }
  return { ok: true };
}

/** Admin-only: invite an email to sign up as an annotator. */
export async function inviteAnnotator(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("annotator_invites")
    .insert({ email: email.trim().toLowerCase(), invited_by: authUser.id });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "That email has already been invited." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type AnnotatorInvite = {
  id: string;
  email: string;
  createdAt: string;
  usedAt: string | null;
};

export async function listAnnotatorInvites(): Promise<AnnotatorInvite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("annotator_invites")
    .select("id, email, created_at, used_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((i) => ({ id: i.id, email: i.email, createdAt: i.created_at, usedAt: i.used_at }));
}
