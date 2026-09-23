"use client";

import type { RosterPlayer } from "@/lib/portal/store";

/**
 * A jersey-number + name list editor — shared by the annotator's roster
 * fix-up panel (RosterManager.tsx), the client upload form, and the
 * client's saved-teams manager. Previously duplicated near-verbatim in
 * two places; this is the one copy all three now use.
 */
export default function RosterEditor({
  label,
  players,
  onChange,
  error,
}: {
  label: string;
  players: RosterPlayer[];
  onChange: (players: RosterPlayer[]) => void;
  error?: string;
}) {
  function updatePlayer(index: number, field: "number" | "name", value: string) {
    onChange(players.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function removePlayer(index: number) {
    onChange(players.length > 1 ? players.filter((_, i) => i !== index) : [{ id: crypto.randomUUID(), number: "", name: "" }]);
  }

  const filledCount = players.filter((p) => p.number.trim() && p.name.trim()).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="hs-label !mb-0">{label}</span>
        <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
          {filledCount} PLAYER{filledCount === 1 ? "" : "S"}
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {players.map((p, i) => (
          <div key={p.id} className="flex gap-2">
            {/* Width is controlled on these wrapper divs, not the inputs
                themselves — .hs-input sets width:100% as unlayered CSS,
                which beats Tailwind's layered w-16/flex-1 utilities if
                applied directly to the input. */}
            <div className="w-16 flex-none">
              <input
                className="hs-input text-center"
                placeholder="#"
                inputMode="numeric"
                maxLength={3}
                value={p.number}
                onChange={(e) => updatePlayer(i, "number", e.target.value)}
                aria-label={`${label} player ${i + 1} jersey number`}
              />
            </div>
            <div className="flex-1">
              <input
                className="hs-input"
                placeholder="Player name"
                value={p.name}
                onChange={(e) => updatePlayer(i, "name", e.target.value)}
                aria-label={`${label} player ${i + 1} name`}
              />
            </div>
            <button
              type="button"
              onClick={() => removePlayer(i)}
              aria-label="Remove player"
              className="flex h-[42px] w-10 flex-none items-center justify-center rounded-md border border-border text-text-faint transition-colors duration-300 hover:border-[#ff6b6b]/40 hover:text-[#ff6b6b]"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]">{error}</p>
      )}

      <button
        type="button"
        onClick={() => onChange([...players, { id: crypto.randomUUID(), number: "", name: "" }])}
        className="mt-3 flex items-center gap-2 font-mono-tech text-[0.66rem] tracking-[0.14em] text-orange-bright transition-colors hover:text-orange"
      >
        + ADD PLAYER
      </button>
    </div>
  );
}
