"use client";

import { useState } from "react";
import type { Project, RosterPlayer } from "@/lib/portal/store";
import type { AnnotationEvent, TeamSide } from "@/lib/portal/events";
import { EVENT_TYPE_LABELS, SHOT_EVENT_TYPES } from "@/lib/portal/events";

type Filter = "all" | "team" | "opponent";

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function findPlayer(project: Project, teamSide: TeamSide, playerId: string): RosterPlayer | undefined {
  const roster = teamSide === "team" ? project.roster : project.opponentRoster ?? [];
  return roster.find((p) => p.id === playerId);
}

export default function EventsList({
  project,
  events,
  onSeek,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  project: Project;
  events: AnnotationEvent[];
  onSeek: (seconds: number) => void;
  onEdit?: (event: AnnotationEvent) => void;
  onDelete?: (eventId: string) => void;
  readOnly?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = events
    .filter((e) => filter === "all" || e.teamSide === filter)
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  return (
    <div className="hs-panel flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">
          SAVED EVENTS ({events.length})
        </p>
        <div className="flex gap-1.5">
          {(
            [
              { key: "all" as const, label: "All" },
              { key: "team" as const, label: "My Team" },
              { key: "opponent" as const, label: "Opposition" },
            ]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`hs-chip !py-1 !text-[0.6rem] transition-colors ${
                filter === f.key ? "!border-orange/50 !text-orange-bright" : "text-text-faint"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex max-h-[420px] flex-col divide-y divide-border overflow-y-auto">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-text-faint">No events tagged yet.</p>
        )}
        {filtered.map((evt) => {
          const player = findPlayer(project, evt.teamSide, evt.playerId);
          const isShot = SHOT_EVENT_TYPES.includes(evt.eventType);
          return (
            <div key={evt.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <button
                type="button"
                onClick={() => onSeek(evt.timestampSeconds)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="flex flex-none flex-col items-center">
                  <span className="font-mono-tech text-[0.62rem] tracking-[0.06em] text-orange-bright">
                    {formatTimestamp(evt.timestampSeconds)}
                  </span>
                  {evt.period && (
                    <span className="font-mono-tech text-[0.52rem] tracking-[0.06em] text-text-faint">
                      {evt.period}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">
                    {player ? `#${player.number} ${player.name}` : "Unknown player"}{" "}
                    <span className="text-text-faint">
                      · {evt.teamSide === "team" ? "Team" : "Opp"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-text-faint">
                    {EVENT_TYPE_LABELS[evt.eventType]}
                    {isShot && (
                      <span className={evt.made ? "ml-1.5 text-orange-bright" : "ml-1.5 text-text-faint"}>
                        · {evt.made ? "MADE" : "MISSED"}
                      </span>
                    )}
                  </p>
                </div>
              </button>
              {!readOnly && onEdit && onDelete && (
                <div className="flex flex-none items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(evt)}
                    aria-label="Edit event"
                    className="text-text-faint transition-colors hover:text-orange-bright"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(evt.id)}
                    aria-label="Delete event"
                    className="text-text-faint transition-colors hover:text-[#ff6b6b]"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
