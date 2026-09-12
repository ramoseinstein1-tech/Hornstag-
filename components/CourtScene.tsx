"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { createCourtTexture } from "./three/courtTexture";
import PlayerMarker, { type PlayerStats } from "./PlayerMarker";

const PLAYERS: { position: [number, number, number]; stats: PlayerStats }[] = [
  {
    position: [-0.9, 0.02, 0.6],
    stats: { number: "23", pts: 24, reb: 6, ast: 5, fg: "9/16", threeP: "4/8" },
  },
  {
    position: [0.6, 0.02, 0.9],
    stats: { number: "11", pts: 14, reb: 3, ast: 9, fg: "5/11", threeP: "2/5" },
  },
  {
    position: [0, 0.02, -0.3],
    stats: { number: "04", pts: 18, reb: 5, ast: 2, fg: "7/13", threeP: "1/3" },
  },
  {
    position: [-0.55, 0.02, -0.9],
    stats: { number: "07", pts: 9, reb: 4, ast: 6, fg: "3/9", threeP: "0/2" },
  },
  {
    position: [0.95, 0.02, -0.6],
    stats: { number: "32", pts: 21, reb: 11, ast: 1, fg: "8/12", threeP: "0/0" },
  },
];

function CourtFloor() {
  const texture = useMemo(() => createCourtTexture(), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[3.2, 3.2]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.78}
        metalness={0.08}
        color="#cfcfcf"
      />
    </mesh>
  );
}

export default function CourtScene() {
  return (
    <Canvas
      dpr={[1, 1.6]}
      shadows
      camera={{ position: [0, 3.4, 2.6], fov: 42 }}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
    >
      <ambientLight intensity={0.3} color="#8fa0b8" />
      <directionalLight
        position={[2, 5, 2]}
        intensity={1.5}
        color="#fff1dc"
        castShadow
      />
      <spotLight
        position={[0, 5, 0]}
        angle={0.7}
        penumbra={1}
        intensity={16}
        color="#ffd9b0"
        distance={12}
      />
      <pointLight
        position={[-2, 1.5, -2]}
        intensity={5}
        color="#ff6a00"
        distance={9}
        decay={2}
      />
      <pointLight
        position={[2.2, 1.2, 2]}
        intensity={2.5}
        color="#ff8b3d"
        distance={9}
        decay={2}
      />

      <group>
        <CourtFloor />
        {PLAYERS.map((p, i) => (
          <PlayerMarker
            key={p.stats.number}
            position={p.position}
            stats={p.stats}
            phase={i * 1.3}
          />
        ))}
      </group>
    </Canvas>
  );
}
