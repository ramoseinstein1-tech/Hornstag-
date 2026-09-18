"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * The Hornstag tiger mascot, floating gently on the auth pages — a 2D
 * cutout (background removed via a connectivity-based flood fill, not
 * a full 3D model like the homepage basketball) animated with Framer
 * Motion rather than WebGL. A real rigged 3D character was the original
 * ask, but the tool that generated this mascot gates model export
 * behind a paid plan; this gets a moving brand element on the page
 * today at zero cost.
 */
export default function AuthMascot() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        className="pointer-events-none absolute h-[65%] w-[65%] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,106,0,0.3), transparent 70%)" }}
        aria-hidden="true"
      />
      <motion.img
        src="/tiger-mascot.webp"
        alt=""
        aria-hidden="true"
        className="relative h-full w-auto max-w-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]"
        animate={
          reducedMotion
            ? undefined
            : {
                y: [0, -14, 0],
                rotate: [-1.2, 1.2, -1.2],
              }
        }
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
