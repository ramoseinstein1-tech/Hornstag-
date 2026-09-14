"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateProfileName, changePassword } from "@/lib/auth/mockAuthStore";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hs-panel sheen-top p-6">
      <h2 className="mb-5 font-mono-tech text-[0.66rem] tracking-[0.2em] text-text-soft">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function AdminSettingsPage() {
  const { user, refresh, signOut } = useAuth();

  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  if (!user) return null;

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

  return (
    <div>
      <p className="eyebrow mb-3">ADMIN CONSOLE</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Account </span>
        <span className="text-gradient-orange">Settings.</span>
      </h1>
      <p className="mt-2 max-w-lg text-sm text-text-muted">
        Manage your profile and account security.
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
                CONTACT ANOTHER ADMIN TO CHANGE YOUR EMAIL
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
    </div>
  );
}
