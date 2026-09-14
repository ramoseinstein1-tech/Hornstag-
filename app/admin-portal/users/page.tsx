"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  listAllUsers,
  updateUserRole,
  deleteAccount,
  type AdminUserSummary,
} from "@/lib/auth/mockAuthStore";
import type { UserRole } from "@/lib/auth/types";
import { formatRelativeTime, deleteUserData as deleteProjectData } from "@/lib/portal/store";
import { deleteUserData as deleteBillingData, getBilling } from "@/lib/portal/billing";
import { deleteUserData as deleteSettingsData } from "@/lib/portal/settings";
import { releaseAnnotatorClaims } from "@/lib/portal/globalProjects";

type Filter = "all" | "client" | "annotator" | "admin";

const ROLE_OPTIONS: UserRole[] = ["client", "annotator", "admin"];

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const users = useMemo(
    () => listAllUsers(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey]
  );

  if (!me) return null;

  const filtered = users.filter((u) => filter === "all" || u.role === filter);

  function handleRoleChange(userId: string, role: UserRole) {
    updateUserRole(userId, role);
    setRefreshKey((k) => k + 1);
  }

  function handleDelete() {
    if (!deleteTarget || deleteConfirm !== deleteTarget.email) return;

    deleteAccount(deleteTarget.id);
    if (deleteTarget.role === "client") {
      deleteProjectData(deleteTarget.id);
      deleteBillingData(deleteTarget.id);
      deleteSettingsData(deleteTarget.id);
    } else if (deleteTarget.role === "annotator") {
      releaseAnnotatorClaims(deleteTarget.id);
    }

    setDeleteTarget(null);
    setDeleteConfirm("");
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Users.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Every account registered in this browser.
      </p>

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
                <th className="px-3 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint">PLAN</th>
                <th className="px-5 py-3 font-mono-tech text-[0.58rem] font-normal tracking-[0.1em] text-text-faint text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-faint">
                    No users match this filter.
                  </td>
                </tr>
              )}
              {filtered.map((u) => {
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
                      {u.role === "client" ? getBilling(u.id).planTier : "—"}
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
    </div>
  );
}
