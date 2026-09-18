"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const BasketballScene = dynamic(() => import("./BasketballScene"), {
  ssr: false,
});

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/** Graceful, non-WebGL fallback per spec §23/27 — not a replacement for the
 * real 3D basketball, only shown when WebGL genuinely isn't available. */
function BasketballFallback() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center md:justify-end md:pr-[8vw]"
      aria-hidden="true"
    >
      <div
        className="h-56 w-56 rounded-full md:h-72 md:w-72"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #ffa347 0%, #ff7a1f 55%, #8a3a10 100%)",
          boxShadow: "0 0 140px 30px rgba(255,106,0,0.22)",
        }}
      />
    </div>
  );
}

export default function Basketball3D() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(hasWebGL());
  }, []);

  if (supported === null) return null;
  if (supported === false) return <BasketballFallback />;
  return <BasketballScene />;
}
