"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import {
  createLeatherTextures,
  createStudioEnvTexture,
  createSeamCurves,
} from "./three/basketballGeometry";

function Ball({ reducedMotion }: { reducedMotion: boolean }) {
  const spinner = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);

  const { colorMap, bumpMap, roughnessMap } = useMemo(
    () => createLeatherTextures(),
    []
  );
  const envMap = useMemo(() => createStudioEnvTexture(), []);
  const seamCurves = useMemo(() => createSeamCurves(1.002), []);

  useEffect(() => {
    return () => {
      colorMap.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
      envMap.dispose();
    };
  }, [colorMap, bumpMap, roughnessMap, envMap]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    if (spinner.current && !reducedMotion) {
      spinner.current.rotation.y += dt * 0.18;
      spinner.current.rotation.x += dt * 0.015;
    }
    if (group.current && !reducedMotion) {
      group.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.07;
    }
  });

  return (
    <group ref={group}>
      <group ref={spinner}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
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
            sheenColor={new THREE.Color("#ffab5e")}
            envMap={envMap}
            envMapIntensity={0.38}
          />
        </mesh>
        {seamCurves.map((curve, i) => (
          <mesh key={i}>
            <tubeGeometry args={[curve, 160, 0.02, 8, true]} />
            <meshStandardMaterial
              color="#120d09"
              roughness={0.85}
              envMap={envMap}
              envMapIntensity={0.25}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function AuthBasketball() {
  const reducedMotion = !!useReducedMotion();

  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      camera={{ position: [0, 0, 3.5], fov: 38 }}
    >
      <ambientLight intensity={0.26} color="#9fb0c4" />
      <directionalLight position={[4, 6, 5]} intensity={1.5} color="#fff1dc" />
      <pointLight
        position={[-4.4, 1.4, -3.4]}
        intensity={11}
        color="#ff6a00"
        distance={16}
        decay={2}
      />
      <pointLight
        position={[3.8, -2.8, 2]}
        intensity={2.6}
        color="#ff8b3d"
        distance={14}
        decay={2}
      />
      <Ball reducedMotion={reducedMotion} />
    </Canvas>
  );
}
