"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  listAllUsers,
  updateUserRole,
  deleteUserAsAdmin,
  inviteAnnotator,
  listAnnotatorInvites,
  type AdminUserSummary,
  type AnnotatorInvite,
} from "@/lib/auth/supabaseAuth";
import type { UserRole } from "@/lib/auth/types";
import { formatRelativeTime, type AnnotationScope } from "@/lib/portal/store";
import { getCreditBatches, creditBalance } from "@/lib/portal/billing";
import { deleteUserData as deleteSettingsData } from "@/lib/portal/settings";

type Filter = "all" | "client" | "annotator" | "admin";

const ROLE_OPTIONS: UserRole[] = ["client", "annotator", "admin"];

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [credits, setCredits] = useState<Map<string, Record<AnnotationScope, number>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const list = await listAllUsers();
    setUsers(list);
    setLoading(false);

    const clients = list.filter((u) => u.role === "client");
    const entries = await Promise.all(
      clients.map(async (u) => [u.id, creditBalance(await getCreditBatches(u.id))] as const)
    );
    setCredits(new Map(entries));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  if (!me) return null;

  const filtered = users.filter((u) => filter === "all" || u.role === filter);

  async function handleRoleChange(userId: string, role: UserRole) {
    setError(null);
    const result = await updateUserRole(userId, role);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await loadUsers();
  }

  async function handleDelete() {
    if (!deleteTarget || deleteConfirm !== deleteTarget.email) return;
    setError(null);

    const result = await deleteUserAsAdmin(deleteTarget.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    // The real account + every DB row (projects, events, claims,
    // credit_batches, etc.) is already gone via Supabase's
    // on-delete-cascade (and claimed_by is set null on any project an
    // annotator had claimed). This call is only cleaning up the OLD
    // localStorage mock data for settings.ts, which hasn't been
    // migrated yet — remove once that migration lands.
    if (deleteTarget.role === "client") {
      deleteSettingsData(deleteTarget.id);
    }

    setDeleteTarget(null);
    setDeleteConfirm("");
    await loadUsers();
  }

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Users.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Every account registered.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] px-4 py-3 font-mono-tech text-[0.68rem] leading-relaxed text-[#ff9b9b]">
          {error}
        </div>
      )}

      <div className="mt-8 flex gap-2">
        {(
          [
            { key: "all" as const, label: "All" },
            { key: "client" as const, label: "Clients" },
            { key: "annotator" as const, label: "Annotators" },
            { key: "admin" as const, label: "Admins" },
          ]
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`hs-chip transition-colors ${filter === f.key ? "!border-orange/50 !text-orange-bright" : "text-text-faint"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 hs-panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">USER</th>
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">ROLE</th>
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">JOINED</th>
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">CREDITS (SINGLE/BOTH)</th>
                <th className="px-5 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-faint">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-faint">
                    No users match this filter.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((u) => {
                  const isSelf = u.id === me.id;
                  return (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3">
                        <p className="text-text">{u.name}</p>
                        <p className="mt-0.5 font-mono-tech text-[0.58rem] tracking-[0.04em] text-text-faint">{u.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="hs-input !w-auto !py-1.5 !pr-8 !text-xs"
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-text-muted">{formatRelativeTime(u.createdAt)}</td>
                      <td className="px-3 py-3 text-text-muted">
                        {u.role === "client"
                          ? `${credits.get(u.id)?.["Single Team"] ?? 0} / ${credits.get(u.id)?.["Both Teams"] ?? 0}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => {
                            setDeleteTarget(u);
                            setDeleteConfirm("");
                          }}
                          className="font-mono-tech text-[0.6rem] tracking-[0.08em] text-[#ff9b9b] transition-colors hover:text-[#ff6b6b] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="hs-panel w-full max-w-md p-6" style={{ borderColor: "rgba(255,107,107,0.25)" }}>
            <h2 className="mb-2 font-mono-tech text-[0.66rem] tracking-[0.2em] text-[#ff9b9b]">DELETE ACCOUNT</h2>
            <p className="mb-4 text-sm leading-relaxed text-text-muted">
              Permanently delete <span className="text-text">{deleteTarget.name}</span>&rsquo;s account
              {deleteTarget.role === "client" && " and all their projects, results, and billing history"}
              {deleteTarget.role === "annotator" && " and release any matches they've claimed"}. This cannot be undone.
            </p>
            <input
              className="hs-input"
              placeholder={`Type "${deleteTarget.email}" to confirm`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }}
                className="hs-btn-ghost"
              >
                CANCEL
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== deleteTarget.email}
                className="rounded-md border px-4 py-2.5 font-mono-tech text-[0.7rem] tracking-[0.1em] text-[#ff9b9b] transition-colors hover:bg-[#ff6b6b]/10 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: "rgba(255,107,107,0.4)" }}
              >
                PERMANENTLY DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 hs-panel p-6">
        <InviteAnnotatorPanel />
      </div>
    </div>
  );
}

function InviteAnnotatorPanel() {
  const [invites, setInvites] = useState<AnnotatorInvite[]>([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const loadInvites = useCallback(async () => {
    setInvites(await listAnnotatorInvites());
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  function flash(text: string, tone: "info" | "error" = "info") {
    setNotice({ text, tone });
    setTimeout(() => setNotice(null), 4000);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    const result = await inviteAnnotator(email);
    setStatus("idle");
    if (!result.ok) {
      flash(result.error, "error");
      return;
    }
    setEmail("");
    flash("Invited. They can now sign up at /annotator-signup with this email.");
    await loadInvites();
  }

  return (
    <div>
      <h2 className="mb-2 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">INVITE ANNOTATOR</h2>
      <p className="mb-4 max-w-lg text-sm text-text-muted">
        Only invited emails can sign up as an annotator.
      </p>

      {notice && (
        <p
          className={`mb-4 font-mono-tech text-[0.62rem] tracking-wide ${
            notice.tone === "error" ? "text-[#ff9b9b]" : "text-orange-bright"
          }`}
        >
          {notice.text}
        </p>
      )}

      <form onSubmit={handleInvite} className="flex flex-wrap gap-3">
        <div className="w-full max-w-xs">
          <input
            type="email"
            className="hs-input"
            placeholder="annotator@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" disabled={status === "sending"} className="hs-btn-secondary disabled:opacity-60">
          {status === "sending" ? "SENDING..." : "SEND INVITE"}
        </button>
      </form>

      {invites.length > 0 && (
        <ul className="mt-5 flex flex-col divide-y divide-border border-t border-border">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-text">{invite.email}</span>
              <span className="font-mono-tech text-[0.58rem] tracking-[0.08em] text-text-faint">
                {invite.usedAt ? `USED ${formatRelativeTime(invite.usedAt).toUpperCase()}` : `INVITED ${formatRelativeTime(invite.createdAt).toUpperCase()}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
