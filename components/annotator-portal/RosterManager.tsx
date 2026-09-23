"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import RosterEditor from "@/components/RosterEditor";
import type { RosterPlayer } from "@/lib/portal/store";

const emptyPlayer = (): RosterPlayer => ({ id: crypto.randomUUID(), number: "", name: "" });

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
