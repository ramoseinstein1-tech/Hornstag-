"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AuthShell from "@/components/auth/AuthShell";
import { listAllUsers, registerFirstAdmin } from "@/lib/auth/supabaseAuth";

type Errors = Partial<Record<"name" | "email" | "password", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One-time, unlinked admin account creation. Deliberately NOT a normal
 * signup page: it only renders a form while zero admin accounts exist,
 * and permanently "disables itself" (shows a plain message instead) the
 * moment one does. The actual check is atomic and server-side (the
 * bootstrap_admin_if_none_exists Postgres function) — the check on load
 * here is just what decides which UI to show, not a security boundary.
 */
export default function AdminBootstrapPage() {
  const router = useRouter();
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  useEffect(() => {
    listAllUsers().then((users) => setAdminExists(users.some((u) => u.role === "admin")));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Enter your full name.";
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("loading");
    const result = await registerFirstAdmin({ name, email, password });
    if (!result.ok) {
      setStatus("idle");
      setFormError(result.error);
      return;
    }
    router.push("/admin-portal");
  }

  const fieldError = (key: keyof Errors) =>
    errors[key] ? (
      <motion.p
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]"
      >
        {errors[key]}
      </motion.p>
    ) : null;

  if (adminExists === null) return null;

  if (adminExists) {
    return (
      <AuthShell
        eyebrow="ADMIN BOOTSTRAP"
        title="Already"
        titleAccent="initialized."
        subtitle="An admin account already exists. Contact an existing admin for access."
        footer={null}
      >
        <div className="hs-panel p-6 text-center text-sm text-text-muted">
          This one-time setup has already been used.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="ADMIN BOOTSTRAP"
      title="Create the"
      titleAccent="first admin."
      subtitle="One-time setup — this only works because no admin account exists yet."
      footer={null}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <AnimatePresence>
          {formError && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] px-4 py-3">
                <span className="mt-0.5 text-[#ff6b6b]">⚠</span>
                <p className="font-mono-tech text-[0.68rem] leading-relaxed tracking-wide text-[#ff9b9b]">
                  {formError}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <label htmlFor="name" className="hs-label">FULL NAME</label>
          <input
            id="name"
            className="hs-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {fieldError("name")}
        </div>

        <div>
          <label htmlFor="email" className="hs-label">EMAIL ADDRESS</label>
          <input
            id="email"
            type="email"
            className="hs-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
          {fieldError("email")}
        </div>

        <div>
          <label htmlFor="password" className="hs-label">PASSWORD</label>
          <input
            id="password"
            type="password"
            className="hs-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
          />
          {fieldError("password")}
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="hs-btn-primary mt-2 w-full disabled:cursor-wait disabled:opacity-80"
        >
          {status === "loading" ? "WORKING" : "CREATE ADMIN ACCOUNT"}
        </button>
      </form>
    </AuthShell>
  );
}
