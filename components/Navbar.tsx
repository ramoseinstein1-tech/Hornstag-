"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const LINKS = [
  { label: "WORKFLOW", href: "/#workflow" },
  { label: "ANNOTATION", href: "/#annotation" },
  { label: "ANALYTICS", href: "/#analytics" },
  { label: "PLATFORM", href: "/#platform" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`absolute inset-0 transition-all duration-700 ${
          scrolled
            ? "border-b border-border bg-background/70 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
        style={
          scrolled
            ? {
                maskImage: "linear-gradient(to bottom, black 70%, transparent)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 70%, transparent)",
              }
            : undefined
        }
      />

      <nav
        className={`relative mx-auto flex max-w-[1440px] items-center justify-between px-6 transition-all duration-700 md:px-10 ${
          scrolled ? "h-16" : "h-22 py-4"
        }`}
        aria-label="Primary"
      >
        <Link href="/" className="group flex items-center" aria-label="Hornstag home">
          <Image
            src="/hornstag-wordmark.png"
            alt="Hornstag"
            width={1528}
            height={638}
            priority
            className="h-8 w-auto transition-transform duration-500 group-hover:scale-[1.04] md:h-9"
          />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group relative block px-4 py-2 font-mono-tech text-[0.68rem] tracking-[0.16em] text-text-muted transition-colors duration-300 hover:text-text"
              >
                {l.label}
                <span className="absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-gradient-to-r from-orange to-orange-bright transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/signin"
            className="font-mono-tech text-[0.68rem] tracking-[0.16em] text-text-muted transition-colors duration-300 hover:text-orange-bright"
          >
            SIGN IN
          </Link>
          <Link href="/signup" className="hs-btn-primary !px-5 !py-3 !text-[0.72rem]">
            GET STARTED
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>

        <button
          className="relative z-10 flex h-10 w-10 flex-col items-center justify-center gap-[5px] md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span
            className={`h-px w-6 bg-text transition-all duration-400 ${
              mobileOpen ? "translate-y-[3px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-px w-6 bg-text transition-all duration-400 ${
              mobileOpen ? "-translate-y-[3px] -rotate-45" : ""
            }`}
          />
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 top-0 -z-10 bg-background/97 backdrop-blur-2xl md:hidden"
          >
            <div className="grid-bg absolute inset-0 opacity-40" />
            <div
              className="bloom absolute -right-20 top-10 h-72 w-72 drift"
              style={{ background: "rgba(255,106,0,0.22)" }}
            />

            <div className="relative flex h-full flex-col justify-center px-8 pb-20">
              <ul className="flex flex-col gap-2">
                {LINKS.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.08 + i * 0.06,
                      duration: 0.5,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <a
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className="block border-b border-border py-4 font-display text-2xl font-semibold tracking-tight text-text"
                    >
                      {l.label}
                    </a>
                  </motion.li>
                ))}
              </ul>

              <motion.div
                className="mt-10 flex flex-col gap-3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, duration: 0.5 }}
              >
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="hs-btn-primary w-full"
                >
                  GET STARTED
                  <span className="arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
                <Link
                  href="/signin"
                  onClick={() => setMobileOpen(false)}
                  className="hs-btn-secondary w-full"
                >
                  SIGN IN
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
