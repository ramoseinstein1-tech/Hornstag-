"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateProfileName, changePassword, deleteOwnAccount, clearSession } from "@/lib/auth/supabaseAuth";
import { deleteUserData as deleteBillingData } from "@/lib/portal/billing";
import {
  getSettings,
  addTeamMember,
  removeTeamMember,
  updateNotifications,
  deleteUserData as deleteSettingsData,
} from "@/lib/portal/settings";
import type { NotificationPrefs } from "@/lib/portal/settings";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 flex-none rounded-full transition-colors duration-300"
      style={{ background: checked ? "var(--orange)" : "var(--surface-light)" }}
    >
      <motion.span
        className="absolute top-1 h-4 w-4 rounded-full bg-background"
        animate={{ left: checked ? "1.5rem" : "0.25rem" }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </button>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hs-panel sheen-top p-6">
      <h2 className="mb-5 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { user, refresh, signOut } = useAuth();
  const router = useRouter();

  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);

  const settings = useMemo(
    () => (user ? getSettings(user.id, { name: user.name, email: user.email }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, refreshKey]
  );

  if (!user || !settings) return null;

  function flashNotice(text: string, tone: "info" | "error" = "info") {
    setNotice({ text, tone });
    setTimeout(() => setNotice(null), 4000);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    const result = await updateProfileName(user.id, name);
    setProfileSaving(false);
    if (!result.ok) {
      flashNotice(result.error, "error");
      return;
    }
    refresh();
    flashNotice("Profile updated.");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPwError(null);

    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New passwords do not match.");
      return;
    }

    setPwSaving(true);
    const result = await changePassword(user.id, { currentPassword: currentPw, newPassword: newPw });
    setPwSaving(false);

    if (!result.ok) {
      setPwError(result.error);
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    flashNotice("Password updated.");
  }

  function handleToggleNotification(key: keyof NotificationPrefs, value: boolean) {
    if (!user) return;
    updateNotifications(user.id, { name: user.name, email: user.email }, { [key]: value });
    setRefreshKey((k) => k + 1);
  }

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !memberName.trim() || !memberEmail.trim()) return;
    addTeamMember(user.id, { name: user.name, email: user.email }, { name: memberName, email: memberEmail });
    setMemberName("");
    setMemberEmail("");
    setRefreshKey((k) => k + 1);
    flashNotice("Team member added. No invite email was sent in this demo.");
  }

  function handleRemoveMember(id: string) {
    if (!user) return;
    removeTeamMember(user.id, { name: user.name, email: user.email }, id);
    setRefreshKey((k) => k + 1);
  }

  async function handleDeleteAccount() {
    if (!user || deleteConfirm !== user.email) return;
    const result = await deleteOwnAccount();
    if (!result.ok) {
      flashNotice(result.error, "error");
      return;
    }
    // The real account + every DB row (projects, events, billing, etc.)
    // is already gone via Supabase's on-delete-cascade. These two calls
    // are only cleaning up the OLD localStorage mock data for billing.ts
    // and settings.ts, which haven't been migrated yet — remove once
    // that migration lands.
    deleteBillingData(user.id);
    deleteSettingsData(user.id);
    await clearSession();
    // A full hard navigation, not router.push(). A client-side transition
    // to "/" isn't instant (it fetches the route), and in that window this
    // very page's ClientPortalGuard would otherwise see the auth context
    // flip to "unauthenticated" and redirect to /signin itself, winning
    // the race and stranding the user on a confusing sign-in screen
    // instead of the homepage. A hard navigation unmounts everything
    // immediately, and the fresh page load reads the already-cleared
    // session with no stale context to reconcile.
    window.location.href = "/";
  }

  return (
    <div>
      <p className="eyebrow mb-3">CLIENT PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Account </span>
        <span className="text-gradient-orange">Settings.</span>
      </h1>
      <p className="mt-2 max-w-lg text-sm text-text-muted">
        Manage your profile, notifications, team, and account security.
      </p>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div
              className="mt-6 rounded-md border px-4 py-3 font-mono-tech text-[0.68rem] leading-relaxed"
              style={
                notice.tone === "error"
                  ? { borderColor: "rgba(255,107,107,0.3)", background: "rgba(255,107,107,0.06)", color: "#ff9b9b" }
                  : { borderColor: "var(--border-orange)", background: "rgba(255,106,0,0.06)", color: "var(--orange-bright)" }
              }
            >
              {notice.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="PROFILE">
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <div>
              <label htmlFor="settings-name" className="hs-label">FULL NAME</label>
              <input
                id="settings-name"
                className="hs-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="settings-email" className="hs-label">EMAIL ADDRESS</label>
              <input id="settings-email" className="hs-input opacity-60" value={user.email} disabled />
              <p className="mt-2 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
                CONTACT SUPPORT TO CHANGE YOUR EMAIL
              </p>
            </div>
            <div>
              <label className="hs-label">ROLE</label>
              <p className="text-sm text-text">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
            </div>
            <button type="submit" disabled={profileSaving} className="hs-btn-secondary mt-2 w-fit disabled:opacity-60">
              {profileSaving ? "SAVING..." : "SAVE PROFILE"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="NOTIFICATION PREFERENCES">
          <div className="flex flex-col gap-5">
            {(
              [
                { key: "projectComplete" as const, label: "Project status changes", desc: "Notify me when a project moves to a new status." },
                { key: "billingReceipts" as const, label: "Billing receipts", desc: "Email me a receipt after each payment." },
                { key: "productUpdates" as const, label: "Product updates", desc: "Occasional news about new Hornstag features." },
              ]
            ).map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-text">{item.label}</p>
                  <p className="mt-0.5 text-xs text-text-faint">{item.desc}</p>
                </div>
                <Toggle
                  checked={settings.notifications[item.key]}
                  onChange={(v) => handleToggleNotification(item.key, v)}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="TEAM MEMBERS">
          <ul className="flex flex-col divide-y divide-border">
            {settings.teamMembers.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{m.name}</p>
                  <p className="truncate font-mono-tech text-[0.6rem] tracking-[0.06em] text-text-faint">{m.email}</p>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <span className="font-mono-tech text-[0.58rem] tracking-[0.1em] text-text-faint">
                    {m.role.toUpperCase()}
                  </span>
                  {m.role !== "Owner" && (
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      aria-label={`Remove ${m.name}`}
                      className="text-text-faint transition-colors hover:text-[#ff6b6b]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddMember} className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
            <p className="font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
              INVITING SOMEONE ADDS THEM HERE — NO EMAIL IS SENT IN THIS DEMO
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="hs-input"
                placeholder="Name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
              />
              <input
                className="hs-input"
                type="email"
                placeholder="Email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="hs-btn-secondary w-fit">INVITE MEMBER</button>
          </form>
        </SectionCard>

        <SectionCard title="SECURITY">
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div>
              <label htmlFor="current-pw" className="hs-label">CURRENT PASSWORD</label>
              <input
                id="current-pw"
                type="password"
                className="hs-input"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor="new-pw" className="hs-label">NEW PASSWORD</label>
              <input
                id="new-pw"
                type="password"
                className="hs-input"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirm-pw" className="hs-label">CONFIRM NEW PASSWORD</label>
              <input
                id="confirm-pw"
                type="password"
                className="hs-input"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {pwError && (
              <p className="font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]">{pwError}</p>
            )}
            <button type="submit" disabled={pwSaving} className="hs-btn-secondary mt-1 w-fit disabled:opacity-60">
              {pwSaving ? "UPDATING..." : "UPDATE PASSWORD"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <button onClick={signOut} className="font-mono-tech text-[0.66rem] tracking-[0.14em] text-text-muted transition-colors hover:text-orange-bright">
              SIGN OUT
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 mb-2">
        <div
          className="hs-panel p-6"
          style={{ borderColor: "rgba(255,107,107,0.25)" }}
        >
          <h2 className="mb-2 font-mono-tech text-[0.66rem] tracking-[0.2em] text-[#ff9b9b]">
            DANGER ZONE
          </h2>
          <p className="mb-4 max-w-lg text-sm text-text-muted">
            Permanently delete your account and all associated projects, results,
            and billing history from this browser. This cannot be undone.
          </p>

          {!deleteArmed ? (
            <button
              onClick={() => setDeleteArmed(true)}
              className="rounded-md border px-4 py-2.5 font-mono-tech text-[0.7rem] tracking-[0.1em] text-[#ff9b9b] transition-colors hover:bg-[#ff6b6b]/10"
              style={{ borderColor: "rgba(255,107,107,0.4)" }}
            >
              DELETE ACCOUNT
            </button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="hs-input sm:max-w-xs"
                placeholder={`Type "${user.email}" to confirm`}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== user.email}
                  className="rounded-md border px-4 py-2.5 font-mono-tech text-[0.7rem] tracking-[0.1em] text-[#ff9b9b] transition-colors hover:bg-[#ff6b6b]/10 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: "rgba(255,107,107,0.4)" }}
                >
                  PERMANENTLY DELETE
                </button>
                <button
                  onClick={() => {
                    setDeleteArmed(false);
                    setDeleteConfirm("");
                  }}
                  className="hs-btn-ghost"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
