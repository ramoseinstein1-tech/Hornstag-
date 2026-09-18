"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, useEffect } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { useScroll, useReducedMotion } from "framer-motion";
import {
  createLeatherTextures,
  createStudioEnvTexture,
  createSeamCurves,
  sampleKeyframes,
  type ScrollKeyframe,
} from "./three/basketballGeometry";

const JOURNEY_KEYFRAMES: ScrollKeyframe[] = [
  { t: 0.0, x: 2.5, y: 0.05, z: 0, scale: 1.58, opacity: 1 },
  { t: 0.1, x: 2.35, y: -0.05, z: 0, scale: 1.48, opacity: 1 },
  { t: 0.17, x: 0.9, y: -0.3, z: -1, scale: 0.95, opacity: 0.9 },
  { t: 0.27, x: -1.7, y: -0.15, z: -1.5, scale: 0.55, opacity: 0.55 },
  { t: 0.35, x: -2.2, y: 0.25, z: -2, scale: 0.32, opacity: 0.15 },
  { t: 0.42, x: 0, y: 0, z: -3, scale: 0.2, opacity: 0 },
  { t: 0.58, x: 0, y: 0, z: -3, scale: 0.2, opacity: 0 },
  { t: 0.65, x: 2.0, y: 0.5, z: -1, scale: 0.4, opacity: 0.22 },
  { t: 0.75, x: 1.5, y: 0.15, z: -1, scale: 0.28, opacity: 0.1 },
  { t: 0.85, x: 0, y: 0, z: 0, scale: 1.15, opacity: 1 },
  { t: 0.94, x: 0, y: 0.15, z: 0.4, scale: 1.45, opacity: 0.9 },
  { t: 1.0, x: 0, y: 0.2, z: 0.4, scale: 1.5, opacity: 0 },
];

const STATIC_FRAME: ScrollKeyframe = {
  t: 0,
  x: 1.6,
  y: 0,
  z: 0,
  scale: 1.35,
  opacity: 1,
};

/** Critically-damped spring — smoother than raw lerp and framerate-independent. */
function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function Basketball({
  scrollRef,
  pointerRef,
  layoutRef,
  reducedMotion,
}: {
  scrollRef: MutableRefObject<number>;
  pointerRef: MutableRefObject<{ x: number; y: number }>;
  layoutRef: MutableRefObject<{ xScale: number; scaleMul: number }>;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const seamGroup = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Sprite>(null);

  const { colorMap, bumpMap, roughnessMap } = useMemo(
    () => createLeatherTextures(),
    []
  );
  const envMap = useMemo(() => createStudioEnvTexture(), []);
  const seamCurves = useMemo(() => createSeamCurves(1.002), []);

  const glowTexture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.16,
      size / 2,
      size / 2,
      size / 2
    );
    grad.addColorStop(0, "rgba(255,132,40,0.5)");
    grad.addColorStop(0.35, "rgba(255,106,0,0.22)");
    grad.addColorStop(0.7, "rgba(214,79,0,0.07)");
    grad.addColorStop(1, "rgba(255,106,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useEffect(() => {
    return () => {
      colorMap.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
      envMap.dispose();
      glowTexture.dispose();
    };
  }, [colorMap, bumpMap, roughnessMap, envMap, glowTexture]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    if (!group.current || !ball.current || !spinner.current) return;

    if (!reducedMotion) {
      spinner.current.rotation.y += dt * 0.15;
      spinner.current.rotation.x += dt * 0.012;
    }

    // Pointer parallax — tilts the whole rig, not the spin axis
    const targetTiltX = reducedMotion ? 0 : pointerRef.current.y * 0.17;
    const targetTiltZ = reducedMotion ? 0 : -pointerRef.current.x * 0.17;
    group.current.rotation.x = damp(group.current.rotation.x, targetTiltX, 2.2, dt);
    group.current.rotation.z = damp(group.current.rotation.z, targetTiltZ, 2.2, dt);

    const frame = reducedMotion
      ? STATIC_FRAME
      : sampleKeyframes(JOURNEY_KEYFRAMES, scrollRef.current);

    const bob = reducedMotion
      ? 0
      : Math.sin(state.clock.elapsedTime * 0.55) * 0.055;

    // Narrow viewports pull the ball back toward centre so it stays on screen
    const { xScale, scaleMul } = layoutRef.current;

    group.current.position.x = damp(
      group.current.position.x,
      frame.x * xScale,
      3,
      dt
    );
    group.current.position.y = damp(group.current.position.y, frame.y + bob, 3, dt);
    group.current.position.z = damp(group.current.position.z, frame.z, 3, dt);

    const s = damp(group.current.scale.x, frame.scale * scaleMul, 3, dt);
    group.current.scale.setScalar(s);

    const mat = ball.current.material as THREE.MeshPhysicalMaterial;
    mat.opacity = damp(mat.opacity, frame.opacity, 3, dt);

    seamGroup.current?.children.forEach((child) => {
      const seamMat = (child as THREE.Mesh)
        .material as THREE.MeshStandardMaterial;
      seamMat.opacity = mat.opacity;
    });

    if (glow.current) {
      const gm = glow.current.material as THREE.SpriteMaterial;
      gm.opacity = damp(gm.opacity, frame.opacity * 0.85, 3, dt);
      const pulse = reducedMotion
        ? 0
        : Math.sin(state.clock.elapsedTime * 0.5) * 0.08;
      glow.current.scale.setScalar(3.7 + pulse);
    }
  });

  return (
    <group ref={group}>
      <sprite ref={glow} position={[0, 0, -0.35]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <group ref={spinner}>
        <mesh ref={ball}>
          <sphereGeometry args={[1, 128, 128]} />
          <meshPhysicalMaterial
            map={colorMap}
            bumpMap={bumpMap}
            bumpScale={0.014}
            roughnessMap={roughnessMap}
            roughness={0.72}
            metalness={0}
            clearcoat={0.1}
            clearcoatRoughness={0.9}
            sheen={0.4}
            sheenRoughness={0.85}
            sheenColor={new THREE.Color("#ff9a52")}
            envMap={envMap}
            envMapIntensity={0.38}
            transparent
          />
        </mesh>

        <group ref={seamGroup}>
          {seamCurves.map((curve, i) => (
            <mesh key={i}>
              <tubeGeometry args={[curve, 200, 0.02, 10, true]} />
              <meshStandardMaterial
                color="#120d09"
                roughness={0.85}
                metalness={0}
                envMap={envMap}
                envMapIntensity={0.25}
                transparent
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.26} color="#9fb0c4" />

      {/* Large soft key — kept moderate so the clearcoat doesn't blow out */}
      <directionalLight
        position={[5, 7, 6]}
        intensity={1.55}
        color="#fff1dc"
      />
      {/* Secondary top-fill to open up the shadow side slightly */}
      <directionalLight
        position={[1, 6, -3]}
        intensity={0.45}
        color="#cfe0f5"
      />
      {/* Orange rim from behind-left — the brand accent */}
      <pointLight
        position={[-5.2, 1.6, -4.5]}
        intensity={13}
        color="#ff6a00"
        distance={18}
        decay={2}
      />
      {/* Warm kicker on the lower right, pushed back to stay soft */}
      <pointLight
        position={[4.6, -3.2, 2.4]}
        intensity={3}
        color="#ff8b3d"
        distance={16}
        decay={2}
      />
      {/* Cool fill */}
      <pointLight
        position={[-3.4, -2.8, 4.4]}
        intensity={1}
        color="#8fa5c0"
        distance={16}
        decay={2}
      />
    </>
  );
}

function usePointerParallax() {
  const pointerRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    function onMove(e: PointerEvent) {
      pointerRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return pointerRef;
}

export default function BasketballScene() {
  const reducedMotion = !!useReducedMotion();
  const pointerRef = usePointerParallax();
  const scrollRef = useRef(0);
  const layoutRef = useRef({ xScale: 1, scaleMul: 1 });
  const { scrollYProgress } = useScroll();
  const [dpr, setDpr] = useState<[number, number]>([1, 1.5]);

  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      scrollRef.current = v;
    });
    return unsub;
  }, [scrollYProgress]);

  useEffect(() => {
    function applyLayout() {
      const w = window.innerWidth;
      if (w < 768) {
        layoutRef.current = { xScale: 0.26, scaleMul: 0.62 };
      } else if (w < 1280) {
        layoutRef.current = { xScale: 0.62, scaleMul: 0.82 };
      } else {
        layoutRef.current = { xScale: 1, scaleMul: 1 };
      }
    }
    applyLayout();
    setDpr(window.innerWidth < 768 ? [1, 1.25] : [1, 1.8]);
    window.addEventListener("resize", applyLayout);
    return () => window.removeEventListener("resize", applyLayout);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
      data-testid="basketball-journey"
    >
      <Canvas
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{ position: [0, 0, 6], fov: 32 }}
      >
        <SceneLights />
        <Basketball
          scrollRef={scrollRef}
          pointerRef={pointerRef}
          layoutRef={layoutRef}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}
