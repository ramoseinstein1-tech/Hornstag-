"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import RosterEditor from "@/components/RosterEditor";
import { createProject, formatFileSize, officialOutcome, uploadProjectVideo } from "@/lib/portal/store";
import type { AnnotationKind, AnnotationScope, GameFormat, RosterPlayer, UploadProgress } from "@/lib/portal/store";
import { createSavedTeam, getSavedTeams } from "@/lib/portal/savedTeams";
import type { SavedTeam } from "@/lib/portal/savedTeams";

type Errors = Partial<
  Record<"name" | "file" | "roster" | "opponentRoster" | "teamScore" | "opponentScore", string>
>;

const emptyPlayer = (): RosterPlayer => ({ id: crypto.randomUUID(), number: "", name: "" });

// A sanity cap, not a platform limit — Cloudflare R2 handles a single PUT
// up to 5GiB, comfortably covering real game footage.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function UploadProjectPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [opponent, setOpponent] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [annotationKind, setAnnotationKind] = useState<AnnotationKind>("traditional");
  const [scope, setScope] = useState<AnnotationScope>("Single Team");
  const [format, setFormat] = useState<GameFormat>("Quarters");
  const [roster, setRoster] = useState<RosterPlayer[]>([emptyPlayer()]);
  const [opponentRoster, setOpponentRoster] = useState<RosterPlayer[]>([emptyPlayer()]);
  const [teamScoreInput, setTeamScoreInput] = useState("");
  const [opponentScoreInput, setOpponentScoreInput] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null);

  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [selectedSavedTeamId, setSelectedSavedTeamId] = useState("");
  const [saveAsTeam, setSaveAsTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    if (!user) return;
    getSavedTeams(user.id).then(setSavedTeams);
  }, [user]);

  function handleFile(f: File | null) {
    setFile(f);
    if (f) setErrors((prev) => ({ ...prev, file: undefined }));
  }

  function loadSavedTeam(teamId: string) {
    setSelectedSavedTeamId(teamId);
    const team = savedTeams.find((t) => t.id === teamId);
    // p.id here IS the saved_team_players id — captured as savedPlayerId
    // before being overwritten with a fresh id for this project's own
    // roster_players row, so this player's career stats can find every
    // project they've ever been loaded into.
    if (team) setRoster(team.roster.map((p) => ({ ...p, savedPlayerId: p.id, id: crypto.randomUUID() })));
  }

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Give the project a name.";
    if (!file) next.file = "Attach a game film to continue.";
    else if (file.size > MAX_UPLOAD_BYTES) {
      next.file = "This file is over the 5GiB upload limit.";
    }

    const validRoster = roster.filter((p) => p.number.trim() && p.name.trim());
    if (validRoster.length === 0) {
      next.roster = "Add at least one player to the roster.";
    }
    if (scope === "Both Teams") {
      const validOpponentRoster = opponentRoster.filter((p) => p.number.trim() && p.name.trim());
      if (validOpponentRoster.length === 0) {
        next.opponentRoster = "Add at least one opponent roster player.";
      }
    }

    // Heart Stats projects have no official score to check the tagged
    // score against — the whole score-check workflow doesn't apply.
    if (annotationKind === "traditional") {
      if (teamScoreInput.trim() === "" || !/^\d+$/.test(teamScoreInput.trim())) {
        next.teamScore = "Enter your team's final score.";
      }
      if (opponentScoreInput.trim() === "" || !/^\d+$/.test(opponentScoreInput.trim())) {
        next.opponentScore = "Enter the opponent's final score.";
      }
    }

    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setUploadError(null);
    setProgress(null);
    setUploadStartedAt(null);
    setStatus("submitting");

    const createResult = await createProject(user.id, {
      name: name.trim(),
      opponent: opponent.trim() || undefined,
      gameDate: gameDate || undefined,
      scope,
      annotationKind,
      format,
      roster: roster.filter((p) => p.number.trim() && p.name.trim()),
      opponentRoster:
        scope === "Both Teams"
          ? opponentRoster.filter((p) => p.number.trim() && p.name.trim())
          : undefined,
      notes: notes.trim() || undefined,
      fileName: file!.name,
      fileSize: formatFileSize(file!.size),
      officialScore:
        annotationKind === "traditional"
          ? { team: Number(teamScoreInput), opponent: Number(opponentScoreInput) }
          : undefined,
    }, user.name);

    if (!createResult.ok) {
      setUploadError(createResult.error);
      setStatus("idle");
      return;
    }
    const project = createResult.project;

    if (saveAsTeam && newTeamName.trim()) {
      const validRoster = roster.filter((p) => p.number.trim() && p.name.trim());
      void createSavedTeam(user.id, newTeamName.trim(), validRoster).then((result) => {
        if (result.ok) getSavedTeams(user.id).then(setSavedTeams);
      });
    }

    setUploadStartedAt(Date.now());
    const uploadResult = await uploadProjectVideo(project.id, file!, setProgress);
    if (!uploadResult.ok) {
      // The project row already exists at this point — it just falls back
      // to the shared sample clip in the workspace until the video is
      // retried. Surface the failure clearly rather than pretending it
      // succeeded.
      setUploadError(uploadResult.error);
      setStatus("idle");
      return;
    }

    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="hs-panel sheen-top p-8"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-orange/40 bg-orange/10 text-orange-bright">
            ✓
          </div>
          <h1 className="mt-5 font-display text-xl font-semibold tracking-tight">
            Project submitted
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            &ldquo;{name}&rdquo; has been added to your dashboard with{" "}
            <span className="text-orange-bright">Processing</span> status.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/client-portal")}
              className="hs-btn-primary flex-1"
            >
              GO TO DASHBOARD
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </button>
            <button
              onClick={() => {
                setStatus("idle");
                setName("");
                setOpponent("");
                setGameDate("");
                setNotes("");
                setFile(null);
                setRoster([emptyPlayer()]);
                setOpponentRoster([emptyPlayer()]);
                setTeamScoreInput("");
                setOpponentScoreInput("");
                setSelectedSavedTeamId("");
                setSaveAsTeam(false);
                setNewTeamName("");
                setAnnotationKind("traditional");
              }}
              className="hs-btn-secondary flex-1"
            >
              UPLOAD ANOTHER
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow mb-3">CLIENT PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">Upload </span>
        <span className="text-gradient-orange">Project.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        Submit new game film for annotation. It&rsquo;ll appear on your
        dashboard immediately with a &ldquo;Processing&rdquo; status.
      </p>

      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] px-4 py-3">
              <span className="mt-0.5 text-[#ff6b6b]">⚠</span>
              <p className="font-mono-tech text-[0.68rem] leading-relaxed tracking-wide text-[#ff9b9b]">
                {uploadError}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} noValidate className="mt-10 flex flex-col gap-6">
        <div>
          <label htmlFor="proj-name" className="hs-label">
            PROJECT NAME
          </label>
          <input
            id="proj-name"
            className="hs-input"
            placeholder="Hawks vs. Celtics — Full Game"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="mt-2 font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]">
              {errors.name}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="proj-opponent" className="hs-label">
              OPPONENT / MATCHUP
            </label>
            <input
              id="proj-opponent"
              className="hs-input"
              placeholder="vs. Lakers"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="proj-date" className="hs-label">
              GAME DATE
            </label>
            <input
              id="proj-date"
              type="date"
              className="hs-input"
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <span className="hs-label">ANNOTATION TYPE</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["traditional", "heart_stats"] as AnnotationKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAnnotationKind(k)}
                className={`rounded-md border px-4 py-[0.62rem] text-left text-sm font-medium transition-all duration-300 ${
                  annotationKind === k
                    ? "border-orange/50 bg-orange/10 text-orange-bright"
                    : "border-border bg-transparent text-text-muted hover:border-border-strong"
                }`}
              >
                {k === "traditional" ? "Traditional Box Score" : "Heart Stats"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <span className="hs-label">ANNOTATION SCOPE</span>
            <div className="grid grid-cols-2 gap-2">
              {(["Single Team", "Both Teams"] as AnnotationScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-md border px-4 py-[0.62rem] text-sm font-medium transition-all duration-300 ${
                    scope === s
                      ? "border-orange/50 bg-orange/10 text-orange-bright"
                      : "border-border bg-transparent text-text-muted hover:border-border-strong"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="hs-label">GAME FORMAT</span>
            <div className="grid grid-cols-2 gap-2">
              {(["Quarters", "Halves"] as GameFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-md border px-4 py-[0.62rem] text-sm font-medium transition-all duration-300 ${
                    format === f
                      ? "border-orange/50 bg-orange/10 text-orange-bright"
                      : "border-border bg-transparent text-text-muted hover:border-border-strong"
                  }`}
                >
                  By {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {annotationKind === "traditional" && (
          <div>
            <span className="hs-label">OFFICIAL FINAL SCORE</span>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="w-full">
                  <input
                    className="hs-input"
                    placeholder="Your team's score"
                    inputMode="numeric"
                    value={teamScoreInput}
                    onChange={(e) => setTeamScoreInput(e.target.value.replace(/[^\d]/g, ""))}
                    aria-invalid={!!errors.teamScore}
                    aria-label="Your team's final score"
                  />
                </div>
                {errors.teamScore && (
                  <p className="mt-2 font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]">
                    {errors.teamScore}
                  </p>
                )}
              </div>
              <div>
                <div className="w-full">
                  <input
                    className="hs-input"
                    placeholder="Opponent's score"
                    inputMode="numeric"
                    value={opponentScoreInput}
                    onChange={(e) => setOpponentScoreInput(e.target.value.replace(/[^\d]/g, ""))}
                    aria-invalid={!!errors.opponentScore}
                    aria-label="Opponent's final score"
                  />
                </div>
                {errors.opponentScore && (
                  <p className="mt-2 font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]">
                    {errors.opponentScore}
                  </p>
                )}
              </div>
            </div>
            {teamScoreInput !== "" && opponentScoreInput !== "" && (
              <p className="mt-3 font-mono-tech text-[0.62rem] tracking-[0.1em] text-orange-bright">
                {(() => {
                  const outcome = officialOutcome({ team: Number(teamScoreInput), opponent: Number(opponentScoreInput) });
                  if (outcome === "tie") return "RESULT: TIE";
                  return outcome === "team" ? "RESULT: YOUR TEAM WINS" : "RESULT: OPPONENT WINS";
                })()}
              </p>
            )}
            <p className="mt-2 font-mono-tech text-[0.6rem] tracking-[0.08em] text-text-faint">
              THIS IS THE GROUND TRUTH — QA CHECKS THE ANNOTATED SCORE AGAINST IT BEFORE COMPLETION
            </p>
          </div>
        )}

        <div>
          {savedTeams.length > 0 && (
            <div className="mb-4">
              <label htmlFor="saved-team" className="hs-label">
                LOAD A SAVED TEAM
              </label>
              <select
                id="saved-team"
                className="hs-input"
                value={selectedSavedTeamId}
                onChange={(e) => loadSavedTeam(e.target.value)}
              >
                <option value="">— Choose a saved team —</option>
                {savedTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.roster.length})
                  </option>
                ))}
              </select>
            </div>
          )}

          <RosterEditor
            label={scope === "Both Teams" ? "YOUR TEAM ROSTER" : "TEAM ROSTER"}
            players={roster}
            onChange={setRoster}
            error={errors.roster}
          />

          <label className="mt-3 flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={saveAsTeam}
              onChange={(e) => setSaveAsTeam(e.target.checked)}
              className="h-4 w-4 accent-orange"
            />
            Save this roster as a team
          </label>
          {saveAsTeam && (
            <input
              className="hs-input mt-2"
              placeholder="Team name (e.g. Hornstag Varsity)"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
          )}
        </div>

        <AnimatePresence initial={false}>
          {scope === "Both Teams" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <RosterEditor
                label="OPPONENT ROSTER"
                players={opponentRoster}
                onChange={setOpponentRoster}
                error={errors.opponentRoster}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <label className="hs-label">GAME FILM</label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className="rounded-md p-8 text-center transition-colors duration-300"
            style={{
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: dragActive
                ? "var(--orange)"
                : errors.file
                  ? "rgba(255,107,107,0.5)"
                  : "var(--border-strong)",
              background: dragActive ? "rgba(255,106,0,0.05)" : "transparent",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-text">{file.name}</p>
                <p className="font-mono-tech text-[0.62rem] tracking-[0.1em] text-text-faint">
                  {formatFileSize(file.size)}
                </p>
                <button
                  type="button"
                  onClick={() => handleFile(null)}
                  className="mt-1 font-mono-tech text-[0.62rem] tracking-[0.14em] text-text-faint transition-colors hover:text-orange-bright"
                >
                  REMOVE
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-sm text-text-muted">
                  Drag &amp; drop game film here, or{" "}
                  <span className="text-orange-bright underline decoration-orange/35 underline-offset-2">
                    browse
                  </span>
                </span>
                <span className="font-mono-tech text-[0.6rem] tracking-[0.1em] text-text-faint">
                  MP4, MOV, WEBM — up to 5GB
                </span>
              </button>
            )}
          </div>
          {errors.file && (
            <p className="mt-2 font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]">
              {errors.file}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="proj-notes" className="hs-label">
            NOTES FOR THE ANNOTATION TEAM (OPTIONAL)
          </label>
          <textarea
            id="proj-notes"
            className="hs-input min-h-[100px] resize-y"
            placeholder="Anything specific you want tracked — e.g. focus on #23's shot selection."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {status === "submitting" && progress && (
          <div className="flex flex-col gap-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-light">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${Math.round((progress.loadedBytes / progress.totalBytes) * 100)}%`,
                  background: "var(--grad-orange)",
                }}
              />
            </div>
            <p className="font-mono-tech text-[0.62rem] tracking-[0.08em] text-text-faint">
              {(() => {
                const pct = Math.round((progress.loadedBytes / progress.totalBytes) * 100);
                const elapsedSec = uploadStartedAt ? (Date.now() - uploadStartedAt) / 1000 : 0;
                const bytesPerSec = elapsedSec > 0 ? progress.loadedBytes / elapsedSec : 0;
                const remainingBytes = progress.totalBytes - progress.loadedBytes;
                const etaSec = bytesPerSec > 0 ? remainingBytes / bytesPerSec : null;
                const speedLabel = bytesPerSec > 0 ? `${formatFileSize(bytesPerSec)}/s` : "…";
                return `${pct}% · ${formatFileSize(progress.loadedBytes)} / ${formatFileSize(progress.totalBytes)} · ${speedLabel}${etaSec != null ? ` · ${formatDuration(etaSec)} left` : ""}`;
              })()}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="hs-btn-primary mt-2 w-full disabled:cursor-wait disabled:opacity-80 sm:w-fit"
        >
          <AnimatePresence mode="wait" initial={false}>
            {status === "submitting" ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                {progress ? "UPLOADING" : "SUBMITTING"}
              </motion.span>
            ) : (
              <motion.span
                key="label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                SUBMIT PROJECT
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </form>
    </div>
  );
}
