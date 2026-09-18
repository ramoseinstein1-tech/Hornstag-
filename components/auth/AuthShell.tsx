"use client";

import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import AuthMascot from "./AuthMascot";

const PROOF = [
  { value: "94", label: "GAMES ANNOTATED" },
  { value: "98.7%", label: "QA ACCURACY" },
  { value: "12.4K", label: "PLAYER EVENTS" },
];

export default function AuthShell({
  eyebrow,
  title,
  titleAccent,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative min-h-[100svh] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden border-r border-border bg-surface lg:block">
        <div className="grid-bg absolute inset-0 opacity-40" />
        <div
          className="bloom drift absolute -left-20 top-1/3 h-[30rem] w-[30rem]"
          style={{ background: "rgba(255,106,0,0.14)" }}
        />
        <div
          className="bloom absolute -right-10 bottom-0 h-[24rem] w-[24rem]"
          style={{ background: "rgba(90,130,200,0.07)" }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[78%] w-full max-w-[420px]">
            <AuthMascot />
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 60% at 50% 50%, transparent 30%, rgba(7,8,9,0.55) 100%)",
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="inline-flex w-fit" aria-label="Hornstag home">
            <Image
              src="/hornstag-wordmark.png"
              alt="Hornstag"
              width={1528}
              height={638}
              priority
              className="h-9 w-auto"
            />
          </Link>

          <div>
            <motion.h2
              className="display-md max-w-sm uppercase"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="text-gradient">Turn game film into </span>
              <span className="text-gradient-orange">game data.</span>
            </motion.h2>

            <motion.dl
              className="mt-10 flex gap-10 border-t border-border pt-7"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {PROOF.map((p) => (
                <div key={p.label}>
                  <dt className="sr-only">{p.label}</dt>
                  <dd className="font-display text-2xl font-semibold tracking-tight text-text">
                    {p.value}
                  </dd>
                  <p className="mt-1 font-mono-tech text-[0.58rem] tracking-[0.16em] text-text-faint">
                    {p.label}
                  </p>
                </div>
              ))}
            </motion.dl>
          </div>
        </div>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────── */}
      <section className="relative flex min-h-[100svh] items-center justify-center px-6 py-16 md:px-12 lg:min-h-0">
        <div
          className="bloom absolute right-0 top-0 h-[26rem] w-[26rem] lg:hidden"
          style={{ background: "rgba(255,106,0,0.1)" }}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-[420px]">
          <Link
            href="/"
            className="mb-10 inline-flex lg:hidden"
            aria-label="Hornstag home"
          >
            <Image
              src="/hornstag-wordmark.png"
              alt="Hornstag"
              width={1528}
              height={638}
              priority
              className="h-8 w-auto"
            />
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="hs-chip mb-6">{eyebrow}</span>
            <h1 className="display-md uppercase">
              <span className="text-gradient">{title} </span>
              <span className="text-gradient-orange">{titleAccent}</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              {subtitle}
            </p>
          </motion.div>

          <motion.div
            className="mt-9"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={null}>{children}</Suspense>
          </motion.div>

          <motion.div
            className="mt-8 text-center text-sm text-text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            {footer}
          </motion.div>

          <div className="mt-10 text-center">
            <Link href="/" className="hs-btn-ghost">
              ← BACK TO SITE
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
