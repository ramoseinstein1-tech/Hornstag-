import * as THREE from "three";

/** Procedural top-down half-court markings on a dark charcoal floor. */
export function createCourtTexture() {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#121516";
  ctx.fillRect(0, 0, w, h);

  // subtle wood-grain streaks
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#000000";
    ctx.fillRect(0, (i / 80) * h, w, 1.2);
  }
  ctx.globalAlpha = 1;

  const line = "rgba(245, 242, 234, 0.55)";
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;

  const margin = 60;
  // outer boundary
  ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

  // center circle
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 110, 0, Math.PI * 2);
  ctx.stroke();

  // halfcourt line
  ctx.beginPath();
  ctx.moveTo(margin, h / 2);
  ctx.lineTo(w - margin, h / 2);
  ctx.stroke();

  // key / paint (top)
  const keyWidth = 260;
  ctx.strokeRect(w / 2 - keyWidth / 2, margin, keyWidth, 260);
  ctx.beginPath();
  ctx.arc(w / 2, margin + 260, 110, 0, Math.PI, false);
  ctx.stroke();

  // key / paint (bottom)
  ctx.strokeRect(w / 2 - keyWidth / 2, h - margin - 260, keyWidth, 260);
  ctx.beginPath();
  ctx.arc(w / 2, h - margin - 260, 110, Math.PI, Math.PI * 2, false);
  ctx.stroke();

  // three-point arcs
  ctx.beginPath();
  ctx.arc(w / 2, margin + 30, 400, 0.2, Math.PI - 0.2, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h - margin - 30, 400, Math.PI + 0.2, Math.PI * 2 - 0.2, false);
  ctx.stroke();

  // orange accent tick at center
  ctx.strokeStyle = "rgba(255,106,0,0.55)";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 6, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
