import * as THREE from "three";

const TEX_SIZE = 2048;

/**
 * Procedural basketball leather: clustered pebble grain, panel shading and a
 * matching bump/roughness set. Structured as a standalone factory so a real
 * GLB/GLTF basketball can later replace this module without touching consumers.
 */
export function createLeatherTextures() {
  const size = TEX_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base leather tone — pushed toward the site's own vivid brand orange
  // (#ff6a00) rather than a photographically "correct" muted basketball
  // orange, so the ball actually pops against the dark background instead
  // of blending into it.
  const base = ctx.createLinearGradient(0, 0, 0, size);
  base.addColorStop(0, "#ff7a1f");
  base.addColorStop(0.5, "#ff8f3d");
  base.addColorStop(1, "#e0611a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Broad tonal variation so the surface isn't flat
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 120 + Math.random() * 320;
    const blotch = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = Math.random() > 0.5;
    blotch.addColorStop(
      0,
      warm ? "rgba(220,120,40,0.12)" : "rgba(120,48,6,0.14)"
    );
    blotch.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = blotch;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Pebble grain — clustered, varied sizes, with a highlight on each pebble
  const pebbles = 52000;
  for (let i = 0; i < pebbles; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * Math.random() * 4.2 + 0.6;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(58,20,2,${0.1 + Math.random() * 0.16})`;
    ctx.fill();

    // tiny specular lip on the upper-left of each pebble
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,186,120,${0.05 + Math.random() * 0.1})`;
    ctx.fill();
  }

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = 8;

  // Bump: grayscale pebble relief matching the colour map's character
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#6e6e6e";
  bctx.fillRect(0, 0, size, size);
  for (let i = 0; i < pebbles; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * Math.random() * 4.2 + 0.6;
    const g = bctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(228,228,228,0.85)");
    g.addColorStop(0.72, "rgba(150,150,150,0.35)");
    g.addColorStop(1, "rgba(28,28,28,0.5)");
    bctx.fillStyle = g;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = 4;

  // Roughness variation — pebble tops catch light, valleys stay matte
  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size / 2;
  roughCanvas.height = size / 2;
  const rctx = roughCanvas.getContext("2d")!;
  rctx.fillStyle = "#8f8f8f";
  rctx.fillRect(0, 0, size / 2, size / 2);
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * (size / 2);
    const y = Math.random() * (size / 2);
    const r = Math.random() * 3 + 0.5;
    rctx.beginPath();
    rctx.arc(x, y, r, 0, Math.PI * 2);
    const v = 110 + Math.floor(Math.random() * 90);
    rctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    rctx.fill();
  }
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { colorMap, bumpMap, roughnessMap };
}

/**
 * Studio environment for specular reflections — a soft gradient sky with a
 * warm key bloom and a cool bounce, mapped equirectangularly. Gives the ball
 * believable highlights without loading an external HDRI.
 */
export function createStudioEnvTexture() {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#2a2f36");
  sky.addColorStop(0.45, "#14171a");
  sky.addColorStop(1, "#050506");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Warm key light source (large soft box)
  const key = ctx.createRadialGradient(w * 0.72, h * 0.24, 0, w * 0.72, h * 0.24, w * 0.3);
  key.addColorStop(0, "rgba(255,238,214,0.95)");
  key.addColorStop(0.4, "rgba(255,190,140,0.3)");
  key.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, w, h);

  // Orange rim bloom opposite the key
  const rim = ctx.createRadialGradient(w * 0.18, h * 0.5, 0, w * 0.18, h * 0.5, w * 0.26);
  rim.addColorStop(0, "rgba(255,106,0,0.75)");
  rim.addColorStop(1, "rgba(255,106,0,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);

  // Cool bounce from below
  const bounce = ctx.createRadialGradient(w * 0.45, h * 0.92, 0, w * 0.45, h * 0.92, w * 0.3);
  bounce.addColorStop(0, "rgba(120,160,210,0.3)");
  bounce.addColorStop(1, "rgba(120,160,210,0)");
  ctx.fillStyle = bounce;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Classic basketball seams as 3D paths on the sphere surface (rather than a
 * flat texture) so they read correctly in relief at any viewing angle — a
 * wavy "equator" seam plus four meridian seams at 45° offsets (rather than
 * just two at 90°), each individually bowed, for a busier criss-cross that
 * reads closer to a real ball's eight-panel layout than a plain 4-panel grid.
 */
export function createSeamCurves(radius: number): THREE.CatmullRomCurve3[] {
  const curves: THREE.CatmullRomCurve3[] = [];
  const segments = 160;

  const equator: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const y = Math.sin(theta * 3) * 0.09;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    equator.push(
      new THREE.Vector3(
        Math.cos(theta) * r * radius,
        y * radius,
        Math.sin(theta) * r * radius
      )
    );
  }
  curves.push(new THREE.CatmullRomCurve3(equator, true));

  const meridianOffsets = [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4];
  meridianOffsets.forEach((offset, idx) => {
    const meridian: THREE.Vector3[] = [];
    // Each meridian bows outward more strongly than a plain great circle,
    // peaking near the equator crossings and easing back to ~0 at the
    // poles — closer to how a real panel seam curves, not a straight line
    // from pole to pole. A per-curve phase offset keeps the four from
    // looking like mechanical copies of each other.
    const phase = idx * 0.9;
    for (let i = 0; i <= segments; i++) {
      const phi = (i / segments) * Math.PI * 2;
      const bow = Math.sin(phi) * Math.sin(phi) * 0.16;
      const wobble = Math.sin(phi * 4 + phase) * 0.045;
      const v = new THREE.Vector3(
        Math.sin(phi) * (1 + bow + wobble),
        Math.cos(phi),
        0
      )
        .normalize()
        .multiplyScalar(radius);
      v.applyAxisAngle(new THREE.Vector3(0, 1, 0), offset);
      meridian.push(v);
    }
    curves.push(new THREE.CatmullRomCurve3(meridian, true));
  });

  return curves;
}

export type ScrollKeyframe = {
  t: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  opacity: number;
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function sampleKeyframes(
  keyframes: ScrollKeyframe[],
  t: number
): ScrollKeyframe {
  const clamped = Math.min(1, Math.max(0, t));
  let a = keyframes[0];
  let b = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (clamped >= keyframes[i].t && clamped <= keyframes[i + 1].t) {
      a = keyframes[i];
      b = keyframes[i + 1];
      break;
    }
  }
  const range = b.t - a.t || 1;
  const localT = smoothstep((clamped - a.t) / range);
  const lerp = (u: number, v: number) => u + (v - u) * localT;
  return {
    t: clamped,
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    z: lerp(a.z, b.z),
    scale: lerp(a.scale, b.scale),
    opacity: lerp(a.opacity, b.opacity),
  };
}
