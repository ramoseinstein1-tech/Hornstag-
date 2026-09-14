"use client";

import { useRef, useState } from "react";
import type { ShotLocation } from "@/lib/portal/events";

/**
 * Horizontal full-court shot-location picker. Proportions and stroke style
 * are inspired by components/three/courtTexture.ts (the marketing site's
 * 3D court) rotated into a landscape, two-basket layout — not a literal
 * geometric port, since that texture is a stylized top-down half-square
 * canvas rather than a real-proportioned court. Shot location is stored
 * normalized 0..1 relative to this diagram's own width/height, so it stays
 * accurate no matter what size it's rendered at.
 */

const COURT_W = 940;
const COURT_H = 500;
const MARGIN = 40;
const KEY_DEPTH = 150;
const KEY_HEIGHT = 160;
const FT_CIRCLE_R = 60;
const CENTER_CIRCLE_R = 70;
const THREE_R = 215;
const THREE_PHI_MAX = 1.3;
const LINE = "rgba(245,242,234,0.5)";
const ACCENT = "rgba(255,106,0,0.6)";

// Where each basket's 3PT arc ends — the "corner" is the straight segment
// connecting that point back to the baseline, matching a real court's
// straight corner-three lines rather than a pure ellipse.
const CORNER_Y_TOP = COURT_H / 2 - THREE_R * Math.sin(THREE_PHI_MAX);
const CORNER_Y_BOTTOM = COURT_H / 2 + THREE_R * Math.sin(THREE_PHI_MAX);
const CORNER_DX = THREE_R * Math.cos(THREE_PHI_MAX);

function threeArcPath(basketX: number, side: "left" | "right"): string {
  const steps = 32;
  const sign = side === "left" ? 1 : -1;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const phi = -THREE_PHI_MAX + (THREE_PHI_MAX * 2 * i) / steps;
    const x = basketX + sign * THREE_R * Math.cos(phi);
    const y = COURT_H / 2 + THREE_R * Math.sin(phi);
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

export default function CourtDiagram({
  value,
  onChange,
  disabled,
}: {
  value: ShotLocation | null;
  onChange: (loc: ShotLocation) => void;
  disabled?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  function locationFromPointer(e: React.PointerEvent<SVGSVGElement>): ShotLocation {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (disabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    onChange(locationFromPointer(e));
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (disabled || !dragging) return;
    onChange(locationFromPointer(e));
  }

  function handlePointerUp() {
    setDragging(false);
  }

  const leftBasketX = MARGIN + 12;
  const rightBasketX = COURT_W - MARGIN - 12;
  const leftKeyCx = MARGIN + KEY_DEPTH;
  const rightKeyCx = COURT_W - MARGIN - KEY_DEPTH;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${COURT_W} ${COURT_H}`}
      className={`w-full rounded-md border border-border ${disabled ? "opacity-50" : "cursor-crosshair"}`}
      style={{
        background:
          "radial-gradient(120% 140% at 50% 50%, rgba(255,106,0,0.05), transparent 60%), var(--surface)",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="img"
      aria-label="Court diagram — click or drag to set shot location"
    >
      {/* outer boundary */}
      <rect
        x={MARGIN}
        y={MARGIN}
        width={COURT_W - MARGIN * 2}
        height={COURT_H - MARGIN * 2}
        rx={4}
        fill="none"
        stroke={LINE}
        strokeWidth={2}
      />

      {/* halfway line + center circle */}
      <line x1={COURT_W / 2} y1={MARGIN} x2={COURT_W / 2} y2={COURT_H - MARGIN} stroke={LINE} strokeWidth={2} />
      <circle cx={COURT_W / 2} cy={COURT_H / 2} r={CENTER_CIRCLE_R} fill="none" stroke={LINE} strokeWidth={2} />
      <circle cx={COURT_W / 2} cy={COURT_H / 2} r={4} fill={ACCENT} />

      {/* left basket: key, corner threes + arc, and a full free-throw ring */}
      <rect x={MARGIN} y={COURT_H / 2 - KEY_HEIGHT / 2} width={KEY_DEPTH} height={KEY_HEIGHT} fill="none" stroke={LINE} strokeWidth={2} />
      <line x1={MARGIN} y1={CORNER_Y_TOP} x2={leftBasketX + CORNER_DX} y2={CORNER_Y_TOP} stroke={LINE} strokeWidth={2} />
      <line x1={MARGIN} y1={CORNER_Y_BOTTOM} x2={leftBasketX + CORNER_DX} y2={CORNER_Y_BOTTOM} stroke={LINE} strokeWidth={2} />
      <path d={threeArcPath(leftBasketX, "left")} fill="none" stroke={LINE} strokeWidth={2} />
      <circle cx={leftKeyCx} cy={COURT_H / 2} r={FT_CIRCLE_R} fill="none" stroke={LINE} strokeWidth={2} />
      <line x1={leftBasketX - 4} y1={COURT_H / 2 - 22} x2={leftBasketX - 4} y2={COURT_H / 2 + 22} stroke={ACCENT} strokeWidth={3} strokeLinecap="round" />

      {/* right basket: key, corner threes + arc, and a full free-throw ring */}
      <rect x={COURT_W - MARGIN - KEY_DEPTH} y={COURT_H / 2 - KEY_HEIGHT / 2} width={KEY_DEPTH} height={KEY_HEIGHT} fill="none" stroke={LINE} strokeWidth={2} />
      <line x1={COURT_W - MARGIN} y1={CORNER_Y_TOP} x2={rightBasketX - CORNER_DX} y2={CORNER_Y_TOP} stroke={LINE} strokeWidth={2} />
      <line x1={COURT_W - MARGIN} y1={CORNER_Y_BOTTOM} x2={rightBasketX - CORNER_DX} y2={CORNER_Y_BOTTOM} stroke={LINE} strokeWidth={2} />
      <path d={threeArcPath(rightBasketX, "right")} fill="none" stroke={LINE} strokeWidth={2} />
      <circle cx={rightKeyCx} cy={COURT_H / 2} r={FT_CIRCLE_R} fill="none" stroke={LINE} strokeWidth={2} />
      <line x1={rightBasketX + 4} y1={COURT_H / 2 - 22} x2={rightBasketX + 4} y2={COURT_H / 2 + 22} stroke={ACCENT} strokeWidth={3} strokeLinecap="round" />

      {value && (
        <g transform={`translate(${value.x * COURT_W}, ${value.y * COURT_H})`}>
          <circle r={16} fill="rgba(255,106,0,0.12)" />
          <circle r={11} fill="rgba(255,106,0,0.2)" stroke="var(--orange)" strokeWidth={2} />
          <circle r={3.5} fill="var(--orange-bright)" />
        </g>
      )}
    </svg>
  );
}
