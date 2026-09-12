"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { createProject, formatFileSize } from "@/lib/portal/store";
import type { ProjectPriority } from "@/lib/portal/store";

const LEVELS = [
  "Youth",
  "High School",
  "College",
  "Semi-Pro",
  "Professional",
  "Other",
];

type Errors = Partial<Record<"name" | "file", string>>;

export default function UploadProjectPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [opponent, setOpponent] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [level, setLevel] = useState(LEVELS[2]);
  const [priority, setPriority] = useState<ProjectPriority>("Standard");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  function handleFile(f: File | null) {
    setFile(f);
    if (f) setErrors((prev) => ({ ...prev, file: undefined }));
  }

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Give the project a name.";
    if (!file) next.file = "Attach a game film to continue.";
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("submitting");

    createProject(user.id, {
      name: name.trim(),
      opponent: opponent.trim() || undefined,
      gameDate: gameDate || undefined,
      level,
      priority,
      notes: notes.trim() || undefined,
      fileName: file!.name,
      fileSize: formatFileSize(file!.size),
    });

    setTimeout(() => setStatus("done"), 700);
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

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="proj-level" className="hs-label">
              COMPETITION LEVEL
            </label>
            <select
              id="proj-level"
              className="hs-input"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="hs-label">TURNAROUND</span>
            <div className="grid grid-cols-2 gap-2">
              {(["Standard", "Rush"] as ProjectPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded-md border px-4 py-[0.62rem] text-sm font-medium transition-all duration-300 ${
                    priority === p
                      ? "border-orange/50 bg-orange/10 text-orange-bright"
                      : "border-border bg-transparent text-text-muted hover:border-border-strong"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

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
                  MP4, MOV — this demo doesn&rsquo;t upload the file anywhere,
                  it just records the name &amp; size
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
                SUBMITTING
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
