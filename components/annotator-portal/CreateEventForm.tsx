"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Project } from "@/lib/portal/store";
import {
  EVENT_TYPE_LABELS,
  SHOT_EVENT_TYPES,
  TEAMLESS_EVENT_TYPES,
  HEART_STAT_EVENT_TYPES,
  BOX_OUT_EVENT_TYPE,
  type AnnotationEvent,
  type EventType,
  type NewEventInput,
  type ShotLocation,
  type TeamSide,
} from "@/lib/portal/events";
import { computeGameClockSeconds, formatClockMMSS, parseClockMMSS, type VideoSegment } from "@/lib/portal/segments";
import CourtDiagram from "./CourtDiagram";

const TRADITIONAL_EVENT_TYPE_ORDER: EventType[] = [
  "two_point",
  "three_point",
  "free_throw",
  "assist",
  "steal",
  "block",
  "turnover",
  "foul",
  "technical_foul",
  "offensive_rebound",
  "defensive_rebound",
  "substitution_in",
  "substitution_out",
  "timeout",
];

const HEART_STATS_EVENT_TYPE_ORDER: EventType[] = [...HEART_STAT_EVENT_TYPES, "custom"];

function formatHHMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

function parseHHMMSS(input: string): number | null {
  const parts = input.trim().split(":").map((p) => p.trim());
  if (parts.length === 0 || parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  let h = 0, m = 0, s = 0;
  if (nums.length === 3) [h, m, s] = nums;
  else if (nums.length === 2) [m, s] = nums;
  else if (nums.length === 1) [s] = nums;
  else return null;
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

const emptyState = {
  // No default event type — the annotator must always pick one explicitly,
  // rather than risk mis-tagging by leaving a stale "Two Point" selected.
  eventType: "" as EventType | "",
  playerId: "",
  made: false,
  shotLocation: null as ShotLocation | null,
  customLabel: "",
};

export default function CreateEventForm({
  project,
  segments,
  currentTimeSeconds,
  editingEvent,
  onSave,
  onCancelEdit,
  activeSegmentLabel,
}: {
  project: Project;
  segments: VideoSegment[];
  currentTimeSeconds: number;
  editingEvent: AnnotationEvent | null;
  onSave: (input: NewEventInput) => Promise<{ ok: boolean; error?: string }>;
  onCancelEdit: () => void;
  activeSegmentLabel?: string;
}) {
  const bothTeams = project.scope === "Both Teams";
  const EVENT_TYPE_ORDER =
    project.annotationKind === "heart_stats" ? HEART_STATS_EVENT_TYPE_ORDER : TRADITIONAL_EVENT_TYPE_ORDER;

  const [timestampInput, setTimestampInput] = useState(formatHHMMSS(currentTimeSeconds));
  const [touched, setTouched] = useState(false);
  const [gameClockInput, setGameClockInput] = useState("");
  const [gameClockTouched, setGameClockTouched] = useState(false);
  const [teamSide, setTeamSide] = useState<TeamSide>("team");
  const [eventType, setEventType] = useState<EventType | "">(emptyState.eventType);
  const [playerId, setPlayerId] = useState(emptyState.playerId);
  const [made, setMade] = useState(emptyState.made);
  const [shotLocation, setShotLocation] = useState<ShotLocation | null>(emptyState.shotLocation);
  const [customLabel, setCustomLabel] = useState(emptyState.customLabel);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate from live video position until the user edits the field
  // manually, or an existing event is loaded for editing.
  useEffect(() => {
    if (!touched && !editingEvent) {
      setTimestampInput(formatHHMMSS(currentTimeSeconds));
    }
  }, [currentTimeSeconds, touched, editingEvent]);

  // Auto-computed from the active period's running game clock (see
  // lib/portal/segments.ts) at whatever timestamp is currently entered —
  // re-derives every time the timestamp changes, until the annotator
  // directly edits this field themselves (the manual-correction case),
  // same touched-flag pattern as the timestamp field above.
  useEffect(() => {
    if (gameClockTouched || editingEvent) return;
    const seconds = parseHHMMSS(timestampInput);
    if (seconds === null) return;
    const activeSegment = segments.find((s) => s.label === activeSegmentLabel);
    const computed = activeSegment ? computeGameClockSeconds(activeSegment, seconds) : null;
    setGameClockInput(computed != null ? formatClockMMSS(computed) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timestampInput, activeSegmentLabel, segments, gameClockTouched, editingEvent]);

  useEffect(() => {
    if (editingEvent) {
      setTimestampInput(formatHHMMSS(editingEvent.timestampSeconds));
      setTouched(true);
      setGameClockInput(editingEvent.gameClockSeconds != null ? formatClockMMSS(editingEvent.gameClockSeconds) : "");
      setGameClockTouched(true);
      setTeamSide(editingEvent.teamSide ?? "team");
      setEventType(editingEvent.eventType);
      setPlayerId(editingEvent.playerId ?? "");
      setMade(editingEvent.made ?? false);
      setShotLocation(editingEvent.shotLocation ?? null);
      setCustomLabel(editingEvent.customLabel ?? "");
      setError(null);
    }
  }, [editingEvent]);

  const roster = teamSide === "team" ? project.roster : project.opponentRoster ?? [];
  const isShotType = eventType !== "" && SHOT_EVENT_TYPES.includes(eventType);
  const isBoxOut = eventType === BOX_OUT_EVENT_TYPE;
  // Box Out gets the same "Successful" checkbox a shot type gets (and
  // the W hotkey toggles it the same way) — it just skips the court
  // diagram below, since shot location doesn't apply.
  const hasSuccessCheckbox = isShotType || isBoxOut;
  const isTeamless = eventType !== "" && TEAMLESS_EVENT_TYPES.includes(eventType);

  // Always points at the current render's submitEvent — the keydown
  // listener below is only re-attached when isShotType changes, so
  // without this it would keep calling a stale closure over whatever
  // timestamp/player/etc. the form held at that point, not the current
  // values as the annotator keeps filling it in.
  const submitEventRef = useRef<() => Promise<void>>(async () => {});

  // Q/R/W tagging hotkeys — Q and R both just submit (same logic the
  // SAVE EVENT button calls); they're two entry points distinguished by
  // which one matches the currently-selected event type, not two
  // different actions. W toggles the "Successful" checkbox — rendered
  // for shot types and Heart Stats' Box Out event alike (hasSuccessCheckbox).
  // Ignored while focus is in a text input/textarea/select so typing in
  // the custom-label field is never hijacked.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const key = e.key.toLowerCase();
      if ((key === "q" && !isShotType) || (key === "r" && isShotType)) {
        e.preventDefault();
        void submitEventRef.current();
      } else if (key === "w" && hasSuccessCheckbox) {
        e.preventDefault();
        setMade((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isShotType, hasSuccessCheckbox]);

  function resetForm() {
    setEventType(emptyState.eventType);
    setPlayerId(emptyState.playerId);
    setMade(emptyState.made);
    setShotLocation(emptyState.shotLocation);
    setCustomLabel(emptyState.customLabel);
    setTouched(false);
    setGameClockTouched(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitEvent();
  }

  // The actual submission logic, split out from handleSubmit so the Q/R
  // hotkeys (which have no real form-submit event to prevent-default on)
  // can call it directly.
  async function submitEvent() {
    setError(null);

    const seconds = parseHHMMSS(timestampInput);
    if (seconds === null) {
      setError("Enter a valid timestamp (HH:MM:SS).");
      return;
    }
    if (!eventType) {
      setError("Select an event type.");
      return;
    }
    if (!isTeamless && !playerId) {
      setError("Select a player.");
      return;
    }
    if (isShotType && !shotLocation) {
      setError("Click the court diagram to set the shot location.");
      return;
    }

    const input: NewEventInput = {
      timestampSeconds: seconds,
      teamSide: isTeamless ? undefined : teamSide,
      playerId: isTeamless ? undefined : playerId,
      eventType,
      made: hasSuccessCheckbox ? made : undefined,
      shotLocation: isShotType ? shotLocation ?? undefined : undefined,
      customLabel: eventType === "custom" ? customLabel.trim() || undefined : undefined,
      gameClockSeconds: parseClockMMSS(gameClockInput) ?? undefined,
    };

    const result = await onSave(input);
    if (!result.ok) {
      // Inline error, inputs preserved — never a native alert(), and never
      // silently discards what the annotator just filled in.
      setError(result.error ?? "Couldn't save this event.");
      return;
    }

    if (editingEvent) onCancelEdit();
    resetForm();
  }
  submitEventRef.current = submitEvent;

  return (
    <form onSubmit={handleSubmit} className="hs-panel sheen-top flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <p className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">
            {editingEvent ? "EDIT EVENT" : "CREATE EVENT"}
          </p>
          {activeSegmentLabel && (
            <span className="hs-chip !py-0.5 !text-[0.56rem]">TAGGING: {activeSegmentLabel}</span>
          )}
        </div>
        {editingEvent && (
          <button
            type="button"
            onClick={() => {
              onCancelEdit();
              resetForm();
            }}
            className="font-mono-tech text-[0.6rem] tracking-[0.12em] text-text-faint hover:text-orange-bright"
          >
            CANCEL EDIT
          </button>
        )}
      </div>

      {bothTeams && !isTeamless && (
        <div>
          <span className="hs-label">TEAM</span>
          <div className="grid grid-cols-2 gap-2">
            {(["team", "opponent"] as TeamSide[]).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => {
                  setTeamSide(side);
                  setPlayerId("");
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-all duration-300 ${
                  teamSide === side
                    ? "border-orange/50 bg-orange/10 text-orange-bright"
                    : "border-border bg-transparent text-text-muted hover:border-border-strong"
                }`}
              >
                {side === "team" ? "My Team" : "Opposition"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="evt-timestamp" className="hs-label">TIMESTAMP</label>
          <div className="flex gap-2">
            <input
              id="evt-timestamp"
              className="hs-input"
              value={timestampInput}
              onChange={(e) => {
                setTimestampInput(e.target.value);
                setTouched(true);
              }}
              placeholder="00:00:00"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setTimestampInput(formatHHMMSS(currentTimeSeconds));
              setTouched(false);
            }}
            className="mt-1.5 font-mono-tech text-[0.58rem] tracking-[0.1em] text-orange-bright hover:text-orange"
          >
            USE CURRENT
          </button>
        </div>

        <div>
          <label htmlFor="evt-game-clock" className="hs-label">GAME CLOCK</label>
          <input
            id="evt-game-clock"
            className="hs-input"
            value={gameClockInput}
            onChange={(e) => {
              setGameClockInput(e.target.value);
              setGameClockTouched(true);
            }}
            placeholder="—"
          />
          <p className="mt-1.5 font-mono-tech text-[0.58rem] tracking-[0.1em] text-text-faint">
            {gameClockTouched ? "Manually set" : "Auto-tracked — edit to correct"}
          </p>
        </div>

        <div>
          <label htmlFor="evt-type" className="hs-label">EVENT TYPE</label>
          <select
            id="evt-type"
            className="hs-input"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType | "")}
          >
            <option value="" disabled>
              Select event type…
            </option>
            {EVENT_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {!isTeamless && (
          <div>
            <label htmlFor="evt-player" className="hs-label">PLAYER</label>
            <select
              id="evt-player"
              className="hs-input"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              <option value="">Select player…</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {eventType === "custom" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <label htmlFor="evt-custom" className="hs-label">CUSTOM LABEL (OPTIONAL)</label>
            <input
              id="evt-custom"
              className="hs-input"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Timeout, substitution…"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {hasSuccessCheckbox && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-4 overflow-hidden"
          >
            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={made}
                onChange={(e) => setMade(e.target.checked)}
                className="peer sr-only"
              />
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-[3px] border text-[9px] transition-all duration-300 ${
                  made
                    ? "border-orange bg-orange text-background"
                    : "border-border-strong bg-transparent text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="text-sm text-text">{isBoxOut ? "Successful box out" : "Successful shot"}</span>
            </label>

            {isShotType && (
              <div>
                <span className="hs-label">SHOT LOCATION</span>
                <CourtDiagram value={shotLocation} onChange={setShotLocation} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] px-4 py-3">
              <span className="mt-0.5 text-[#ff6b6b]">⚠</span>
              <p className="font-mono-tech text-[0.68rem] leading-relaxed tracking-wide text-[#ff9b9b]">
                {error}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end">
        <button type="submit" className="hs-btn-primary">
          {editingEvent ? "UPDATE EVENT" : "SAVE EVENT"}
        </button>
      </div>
    </form>
  );
}
