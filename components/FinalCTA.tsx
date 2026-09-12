"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";

const POINTS = ["NO SETUP REQUIRED", "BASKETBALL-NATIVE MODEL", "QA ON EVERY EVENT"];

export default function FinalCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });

  return (
    <section
      id="final-cta"
      ref={ref}
      className="relative flex min-h-[92svh] items-center justify-center overflow-hidden"
    >
      <div className="grid-bg mask-fade-bottom absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(62% 56% at 50% 45%, rgba(7,8,9,0.8) 0%, rgba(7,8,9,0.4) 55%, transparent 82%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <motion.div
          className="mb-7 inline-flex"
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <span className="hs-chip">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-orange" />
            HORNSTAG / GET STARTED
          </span>
        </motion.div>

        <motion.h2
          className="display-xl uppercase"
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-gradient">Ready to read </span>
          <span className="text-gradient-orange">the game?</span>
        </motion.h2>

        <motion.p
          className="mx-auto mt-7 max-w-lg text-balance text-base leading-relaxed text-text-muted md:text-lg"
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          Turn basketball footage into data that moves at the speed of the game.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link href="/signup" className="hs-btn-primary">
            GET STARTED
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <a href="#platform" className="hs-btn-secondary">
            EXPLORE THE PLATFORM
          </a>
        </motion.div>

        <motion.ul
          className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.9, delay: 0.55 }}
        >
          {POINTS.map((p) => (
            <li
              key={p}
              className="flex items-center gap-2 font-mono-tech text-[0.62rem] tracking-[0.16em] text-text-faint"
            >
              <span className="text-orange">✓</span>
              {p}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
