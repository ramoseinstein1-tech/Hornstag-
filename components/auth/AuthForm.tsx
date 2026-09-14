"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthProvider";
import { registerUser, registerAnnotator, authenticateUser } from "@/lib/auth/supabaseAuth";
import { ROLE_HOME, type UserRole } from "@/lib/auth/types";

type Mode = "signin" | "signup";

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABEL = ["TOO SHORT", "WEAK", "FAIR", "STRONG", "EXCELLENT"];

export default function AuthForm({ mode, role = "client" }: { mode: Mode; role?: UserRole }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh: refreshAuth } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  const strength = passwordStrength(password);

  function validate(): Errors {
    const next: Errors = {};
    if (isSignup && name.trim().length < 2) {
      next.name = "Enter your full name.";
    }
    if (!EMAIL_RE.test(email)) {
      next.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }
    if (isSignup && confirm !== password) {
      next.confirm = "Passwords do not match.";
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("loading");

    const result = isSignup
      ? role === "annotator"
        ? await registerAnnotator({ name, email, password })
        : await registerUser({ name, email, password })
      : await authenticateUser({ email, password });

    if (!result.ok) {
      setStatus("idle");
      setFormError(result.error);
      return;
    }

    await refreshAuth();

    const redirectTarget = searchParams.get("redirect");
    const roleHome = ROLE_HOME[result.user.role] ?? "/client-portal";
    // Only honor a redirect target that actually belongs to this user's own
    // portal — otherwise a client could be sent into /annotator-portal (or
    // vice versa) via a crafted ?redirect= param.
    const destination =
      redirectTarget && redirectTarget.startsWith(roleHome) ? redirectTarget : roleHome;

    router.push(destination);
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

  return (
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

      {isSignup && (
        <div>
          <label htmlFor="name" className="hs-label">
            FULL NAME
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            className="hs-input"
            placeholder="Alex Carter"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          <span id="name-error">{fieldError("name")}</span>
        </div>
      )}

      <div>
        <label htmlFor="email" className="hs-label">
          EMAIL ADDRESS
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="hs-input"
          placeholder="you@team.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        <span id="email-error">{fieldError("email")}</span>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="hs-label">
            PASSWORD
          </label>
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="mb-2 font-mono-tech text-[0.6rem] tracking-[0.14em] text-text-faint transition-colors hover:text-orange-bright"
          >
            {showPw ? "HIDE" : "SHOW"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={showPw ? "text" : "password"}
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="hs-input"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        <span id="password-error">{fieldError("password")}</span>

        {isSignup && password.length > 0 && (
          <div className="mt-3">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  className="h-[3px] flex-1 rounded-full"
                  animate={{
                    backgroundColor:
                      i < strength ? "var(--orange)" : "var(--surface-light)",
                  }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
            <p className="mt-2 font-mono-tech text-[0.58rem] tracking-[0.16em] text-text-faint">
              {STRENGTH_LABEL[strength]}
            </p>
          </div>
        )}
      </div>

      {isSignup && (
        <div>
          <label htmlFor="confirm" className="hs-label">
            CONFIRM PASSWORD
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            className="hs-input"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "confirm-error" : undefined}
          />
          <span id="confirm-error">{fieldError("confirm")}</span>
        </div>
      )}

      {!isSignup && (
        <div className="flex justify-end">
          <button
            type="button"
            className="font-mono-tech text-[0.62rem] tracking-[0.14em] text-text-faint transition-colors hover:text-orange-bright"
          >
            FORGOT PASSWORD?
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="hs-btn-primary mt-2 w-full disabled:cursor-wait disabled:opacity-80"
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "loading" ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" />
              WORKING
            </motion.span>
          ) : (
            <motion.span
              key="label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              {isSignup ? "CREATE ACCOUNT" : "SIGN IN"}
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {isSignup && (
        <p className="text-center text-[0.7rem] leading-relaxed text-text-faint">
          By creating an account you agree to the{" "}
          <Link
            href="/terms"
            className="text-text-muted underline decoration-orange/35 underline-offset-2 transition-colors hover:text-orange-bright"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-text-muted underline decoration-orange/35 underline-offset-2 transition-colors hover:text-orange-bright"
          >
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </form>
  );
}
