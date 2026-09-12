"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";

export default function CinematicStatement() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px -20% 0px" });
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const trailX = useTransform(scrollYProgress, [0, 1], ["-30%", "30%"]);
  const trailOpacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.6, 1],
    [0, 1, 1, 0]
  );

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden"
    >
      {/* Light trail sweeping with scroll */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-[85vw] -translate-x-1/2 -translate-y-1/2 blur-[3px]"
        style={{
          x: reduced ? 0 : trailX,
          opacity: reduced ? 0.5 : trailOpacity,
          background:
            "linear-gradient(90deg, transparent, rgba(255,106,0,0.55) 45%, rgba(255,139,61,0.75) 50%, rgba(255,106,0,0.55) 55%, transparent)",
        }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-[70vw] -translate-x-1/2 -translate-y-1/2 blur-[70px]"
        style={{
          x: reduced ? 0 : trailX,
          opacity: reduced ? 0.3 : trailOpacity,
          background:
            "linear-gradient(90deg, transparent, rgba(255,106,0,0.3), transparent)",
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 52% at 50% 50%, rgba(7,8,9,0.78) 0%, rgba(7,8,9,0.34) 55%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 px-6 text-center">
        <motion.h2
          className="display-xl uppercase"
          initial={{ opacity: 0, y: reduced ? 0 : 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-gradient">THE GAME MOVES FAST.</span>
        </motion.h2>

        <motion.h2
          className="display-xl mt-3 uppercase"
          initial={{ opacity: 0, y: reduced ? 0 : 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 1,
            delay: reduced ? 0.15 : 0.95,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <span className="text-gradient">DATA SHOULD </span>
          <motion.span
            className="inline-block"
            initial={{ color: "#d8d4ca", filter: "brightness(1)" }}
            animate={
              inView
                ? {
                    color: "#ff6a00",
                    filter: "brightness(1.15)",
                  }
                : {}
            }
            transition={{
              duration: 1.4,
              delay: reduced ? 0.3 : 2.2,
              ease: "easeInOut",
            }}
            style={{
              textShadow: "0 0 60px rgba(255,106,0,0.35)",
            }}
          >
            TOO.
          </motion.span>
        </motion.h2>
      </div>
    </section>
  );
}
