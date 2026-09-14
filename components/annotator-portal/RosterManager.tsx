"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RosterPlayer } from "@/lib/portal/store";

const emptyPlayer = (): RosterPlayer => ({ id: crypto.randomUUID(), number: "", name: "" });

function RosterEditor({
  label,
  players,
  onChange,
}: {
  label: string;
  players: RosterPlayer[];
  onChange: (players: RosterPlayer[]) => void;
}) {
  function updatePlayer(index: number, field: "number" | "name", value: string) {
    onChange(players.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function removePlayer(index: number) {
    onChange(players.length > 1 ? players.filter((_, i) => i !== index) : [emptyPlayer()]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="hs-label !mb-0">{label}</span>
        <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
          {players.filter((p) => p.number.trim() && p.name.trim()).length} PLAYER
          {players.filter((p) => p.number.trim() && p.name.trim()).length === 1 ? "" : "S"}
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

      <button
        type="button"
        onClick={() => onChange([...players, emptyPlayer()])}
        className="mt-3 flex items-center gap-2 font-mono-tech text-[0.66rem] tracking-[0.14em] text-orange-bright transition-colors hover:text-orange"
      >
        + ADD PLAYER
      </button>
    </div>
  );
}

export default function RosterManager({
  scope,
  roster,
  opponentRoster,
  onSave,
}: {
  scope: "Single Team" | "Both Teams";
  roster: RosterPlayer[];
  opponentRoster: RosterPlayer[] | undefined;
  onSave: (roster: RosterPlayer[], opponentRoster?: RosterPlayer[]) => void;
}) {
  const [teamRoster, setTeamRoster] = useState<RosterPlayer[]>(roster.length > 0 ? roster : [emptyPlayer()]);
  const [oppRoster, setOppRoster] = useState<RosterPlayer[]>(
    opponentRoster && opponentRoster.length > 0 ? opponentRoster : [emptyPlayer()]
  );
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave(
      teamRoster.filter((p) => p.number.trim() && p.name.trim()),
      scope === "Both Teams" ? oppRoster.filter((p) => p.number.trim() && p.name.trim()) : undefined
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="hs-panel sheen-top flex flex-col gap-6 p-5">
      <p className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">MANAGE ROSTER</p>
      <p className="-mt-3 text-xs leading-relaxed text-text-faint">
        Fix a jersey number or add a player the client missed — changes save straight to
        this project&rsquo;s roster.
      </p>

      <RosterEditor
        label={scope === "Both Teams" ? "YOUR TEAM ROSTER" : "TEAM ROSTER"}
        players={teamRoster}
        onChange={setTeamRoster}
      />

      {scope === "Both Teams" && (
        <RosterEditor label="OPPONENT ROSTER" players={oppRoster} onChange={setOppRoster} />
      )}

      <div className="flex items-center gap-4">
        <button type="button" onClick={handleSave} className="hs-btn-primary w-fit">
          SAVE ROSTER
        </button>
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-mono-tech text-[0.62rem] tracking-[0.1em] text-orange-bright"
            >
              ROSTER SAVED
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
