"use client";

import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

export type PlayerStats = {
  number: string;
  pts: number;
  reb: number;
  ast: number;
  fg: string;
  threeP: string;
};

export default function PlayerMarker({
  position,
  stats,
  phase = 0,
}: {
  position: [number, number, number];
  stats: PlayerStats;
  phase?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);
  const [hovered, setHovered] = useState(false);

  const glowTexture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    g.addColorStop(0, "rgba(255,139,61,0.85)");
    g.addColorStop(0.4, "rgba(255,106,0,0.3)");
    g.addColorStop(1, "rgba(255,106,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;

    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t * 1.3 + phase) * 0.028;
      const target = hovered ? 1.55 : 1;
      ref.current.scale.setScalar(
        THREE.MathUtils.lerp(ref.current.scale.x, target, 1 - Math.exp(-9 * dt))
      );
    }

    if (ring.current) {
      // pulsing ground ring
      const cycle = (t * 0.55 + phase * 0.3) % 1;
      const s = 0.16 + cycle * 0.26;
      ring.current.scale.setScalar(s);
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - cycle) * (hovered ? 0.75 : 0.4);
    }

    if (glow.current) {
      const gm = glow.current.material as THREE.SpriteMaterial;
      gm.opacity = THREE.MathUtils.lerp(
        gm.opacity,
        hovered ? 0.95 : 0.5,
        1 - Math.exp(-8 * dt)
      );
    }
  });

  return (
    <group position={position}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial
          color="#ff6a00"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <sprite ref={glow} scale={0.42}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <mesh
        ref={ref}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[0.075, 32, 32]} />
        <meshStandardMaterial
          color="#ff8b3d"
          emissive="#ff6a00"
          emissiveIntensity={hovered ? 3 : 1.6}
          toneMapped={false}
        />
      </mesh>

      <Html position={[0, 0.2, 0]} center style={{ pointerEvents: "none" }}>
        <div
          className="whitespace-nowrap font-mono-tech text-[10px] tracking-[0.1em] text-text-muted transition-opacity duration-300"
          style={{ opacity: hovered ? 0 : 0.8 }}
        >
          #{stats.number}
        </div>
      </Html>

      {hovered && (
        <Html position={[0, 0.28, 0]} center style={{ pointerEvents: "none" }}>
          <div
            className="w-[168px] -translate-y-full rounded-md border px-3.5 py-3 text-left backdrop-blur-md"
            style={{
              borderColor: "var(--border-orange)",
              background:
                "linear-gradient(160deg, rgba(27,31,35,0.96), rgba(11,13,15,0.96))",
              boxShadow:
                "0 20px 50px -20px rgba(0,0,0,0.9), 0 0 30px -10px rgba(255,106,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-orange-bright">
                PLAYER #{stats.number}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-orange" />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono-tech text-[0.62rem] text-text">
              <span>
                PTS <b className="text-orange-bright">{stats.pts}</b>
              </span>
              <span>REB {stats.reb}</span>
              <span>AST {stats.ast}</span>
              <span>FG {stats.fg}</span>
              <span className="col-span-2">3P {stats.threeP}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
