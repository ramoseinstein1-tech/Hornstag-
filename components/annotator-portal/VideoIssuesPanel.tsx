"use client";

import { useState } from "react";
import {
  ISSUE_TYPE_LABELS,
  ISSUE_TYPE_ORDER,
  reportVideoIssue,
  deleteVideoIssue,
  type IssueSeverity,
  type IssueType,
  type VideoIssue,
} from "@/lib/portal/videoIssues";

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

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  low: "text-text-faint",
  medium: "text-orange-bright",
  high: "text-[#ff9b9b]",
};

/**
 * Report + list video-quality issues for a project — used both in the
 * annotator workspace (while tagging) and the admin QA review page.
 * Visible to the client too on their Results page (read-only there).
 */
export default function VideoIssuesPanel({
  projectId,
  issues,
  currentTimeSeconds,
  reporterName,
  reporterRole,
  currentUserId,
  isAdmin,
  onChange,
}: {
  projectId: string;
  issues: VideoIssue[];
  currentTimeSeconds?: number;
  reporterName: string;
  reporterRole: string;
  currentUserId?: string;
  isAdmin: boolean;
  onChange: () => void | Promise<void>;
}) {
  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [timestampInput, setTimestampInput] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!issueType) {
      setError("Select an issue type.");
      return;
    }

    const timestampSeconds = timestampInput.trim() ? parseHHMMSS(timestampInput) : null;
    if (timestampInput.trim() && timestampSeconds === null) {
      setError("Enter a valid timestamp (HH:MM:SS) or leave it blank.");
      return;
    }

    setSubmitting(true);
    const result = await reportVideoIssue(projectId, {
      reporterName,
      reporterRole,
      issueType,
      severity,
      timestampSeconds: timestampSeconds ?? undefined,
      description: description.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIssueType("");
    setSeverity("medium");
    setTimestampInput("");
    setDescription("");
    await onChange();
  }

  async function handleDelete(issueId: string) {
    await deleteVideoIssue(issueId);
    await onChange();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="hs-panel sheen-top flex flex-col gap-4 p-5">
        <p className="font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">REPORT A VIDEO ISSUE</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="issue-type" className="hs-label">ISSUE TYPE</label>
            <select
              id="issue-type"
              className="hs-input"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType | "")}
            >
              <option value="" disabled>Select an issue…</option>
              {ISSUE_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{ISSUE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="issue-severity" className="hs-label">SEVERITY</label>
            <select
              id="issue-severity"
              className="hs-input"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label htmlFor="issue-timestamp" className="hs-label">TIMESTAMP (OPTIONAL)</label>
            <input
              id="issue-timestamp"
              className="hs-input"
              value={timestampInput}
              onChange={(e) => setTimestampInput(e.target.value)}
              placeholder="00:00:00"
            />
            {currentTimeSeconds != null && (
              <button
                type="button"
                onClick={() => setTimestampInput(formatHHMMSS(currentTimeSeconds))}
                className="mt-1.5 font-mono-tech text-[0.58rem] tracking-[0.1em] text-orange-bright hover:text-orange"
              >
                USE CURRENT
              </button>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="issue-description" className="hs-label">DESCRIPTION (OPTIONAL)</label>
          <textarea
            id="issue-description"
            className="hs-input min-h-[70px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything else worth noting…"
          />
        </div>

        {error && (
          <p className="font-mono-tech text-[0.62rem] tracking-wide text-[#ff6b6b]">{error}</p>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="hs-btn-primary disabled:cursor-wait disabled:opacity-70">
            {submitting ? "REPORTING…" : "REPORT ISSUE"}
          </button>
        </div>
      </form>

      <div className="hs-panel flex flex-col p-4">
        <p className="mb-3 font-mono-tech text-[0.6rem] tracking-[0.16em] text-text-faint">
          REPORTED ISSUES ({issues.length})
        </p>
        {issues.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-faint">No issues reported yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {issues.map((issue) => (
              <li key={issue.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm text-text">
                    {ISSUE_TYPE_LABELS[issue.issueType]}
                    <span className={`ml-2 font-mono-tech text-[0.56rem] tracking-[0.08em] ${SEVERITY_STYLES[issue.severity]}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                  </p>
                  {issue.description && (
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{issue.description}</p>
                  )}
                  <p className="mt-1 font-mono-tech text-[0.56rem] tracking-[0.08em] text-text-faint">
                    {issue.reporterName} ({issue.reporterRole})
                    {issue.timestampSeconds != null && ` · ${formatHHMMSS(issue.timestampSeconds)}`}
                  </p>
                </div>
                {(isAdmin || issue.reportedBy === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(issue.id)}
                    aria-label="Delete issue"
                    className="flex-none text-text-faint transition-colors hover:text-[#ff6b6b]"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
