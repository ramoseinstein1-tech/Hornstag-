"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import BasketballHUD from "./BasketballHUD";

const lineVariants = {
  hidden: { y: "112%" },
  visible: (i: number) => ({
    y: 0,
    transition: {
      duration: 1,
      delay: 0.18 + i * 0.11,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

const STATS = [
  { value: "94", label: "GAMES ANNOTATED" },
  { value: "98.7%", label: "QA ACCURACY" },
  { value: "12.4K", label: "PLAYER EVENTS" },
];

export default function Hero() {
  const reduced = useReducedMotion();

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 md:pt-24"
    >
      <div className="grid-bg mask-fade-bottom absolute inset-0 opacity-50" />
      <div
        className="bloom drift absolute -left-32 top-1/4 h-[32rem] w-[32rem]"
        style={{ background: "rgba(255,106,0,0.1)" }}
        aria-hidden="true"
      />
      <div
        className="bloom absolute right-0 top-0 h-[28rem] w-[28rem]"
        style={{ background: "rgba(90,130,200,0.07)" }}
        aria-hidden="true"
      />

      <BasketballHUD />

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-10 px-6 md:px-10 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <motion.div
            className="mb-8 inline-flex"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <span className="hs-chip">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-orange" />
              HORNSTAG / BASKETBALL INTELLIGENCE
            </span>
          </motion.div>

          <h1 className="display-hero uppercase">
            {["TURN GAME FILM", "INTO"].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]">
                <motion.span
                  className="text-gradient block"
                  custom={i}
                  variants={lineVariants}
                  initial={reduced ? undefined : "hidden"}
                  animate="visible"
                >
                  {line}
                </motion.span>
              </span>
            ))}
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="text-gradient-orange block"
                custom={2}
                variants={lineVariants}
                initial={reduced ? undefined : "hidden"}
                animate="visible"
              >
                GAME DATA.
              </motion.span>
            </span>
          </h1>

          <motion.p
            className="mt-8 max-w-md text-balance text-base leading-relaxed text-text-muted md:text-[1.0625rem]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            Transform basketball footage into structured events, reliable game
            data, and actionable insights.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.88, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link href="/signup" className="hs-btn-primary">
              EXPLORE THE PLATFORM
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <a href="#workflow" className="hs-btn-secondary">
              SEE HOW IT WORKS
            </a>
          </motion.div>

          <motion.dl
            className="mt-10 flex flex-wrap gap-x-6 gap-y-5 border-t border-border pt-7 sm:gap-x-10 md:mt-12"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
          >
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-2xl font-semibold tracking-tight text-text md:text-3xl">
                  {s.value}
                </dd>
                <p className="mt-1 font-mono-tech text-[0.62rem] tracking-[0.18em] text-text-faint">
                  {s.label}
                </p>
              </div>
            ))}
          </motion.dl>
        </div>

        <div className="hidden lg:block" aria-hidden="true" />
      </div>

      <motion.a
        href="#workflow"
        className="absolute bottom-10 right-8 z-10 hidden flex-col items-center gap-3 font-mono-tech text-[0.62rem] tracking-[0.22em] text-text-faint transition-colors hover:text-orange-bright lg:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.6 }}
      >
        SCROLL
        <span className="relative block h-10 w-px overflow-hidden bg-border">
          <motion.span
            className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-orange to-transparent"
            animate={reduced ? {} : { y: [-16, 40] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      </motion.a>
    </section>
  );
}
