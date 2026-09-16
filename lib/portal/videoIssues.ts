/**
 * VIDEO QUALITY ISSUES (Phase 8)
 * ─────────────────────────────────────────────────────────────────
 * Lets an annotator (while tagging) or an admin (during QA review) flag
 * a video-quality problem that affects tagging — camera away from the
 * ball, scoreboard not visible, missing footage, etc. Visible to the
 * client too (a deliberate decision, not an internal-only tool) — see
 * supabase/migrations/00000000000016_video_issues.sql for the RLS.
 */

import { createClient } from "@/lib/supabase/client";

export type IssueType =
  | "camera_away_from_ball"
  | "play_out_of_view"
  | "camera_shaking"
  | "scoreboard_not_visible"
  | "scoreboard_incorrect"
  | "video_edited_precut"
  | "missing_footage"
  | "abrupt_video_skip"
  | "black_screen"
  | "audio_only"
  | "video_starts_mid_play"
  | "quarter_missing"
  | "player_identification_unclear"
  | "foul_contact_not_visible"
  | "free_throw_sequence_unclear"
  | "other";

export type IssueSeverity = "low" | "medium" | "high";

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  camera_away_from_ball: "Camera away from ball",
  play_out_of_view: "Play out of view",
  camera_shaking: "Camera shaking",
  scoreboard_not_visible: "Scoreboard not visible",
  scoreboard_incorrect: "Scoreboard incorrect",
  video_edited_precut: "Video edited/pre-cut",
  missing_footage: "Missing footage",
  abrupt_video_skip: "Abrupt video skip",
  black_screen: "Black screen",
  audio_only: "Audio only",
  video_starts_mid_play: "Video starts mid-play",
  quarter_missing: "Quarter missing",
  player_identification_unclear: "Player identification unclear",
  foul_contact_not_visible: "Foul contact not visible",
  free_throw_sequence_unclear: "Free throw sequence unclear",
  other: "Other",
};

export const ISSUE_TYPE_ORDER: IssueType[] = [
  "camera_away_from_ball",
  "play_out_of_view",
  "camera_shaking",
  "scoreboard_not_visible",
  "scoreboard_incorrect",
  "video_edited_precut",
  "missing_footage",
  "abrupt_video_skip",
  "black_screen",
  "audio_only",
  "video_starts_mid_play",
  "quarter_missing",
  "player_identification_unclear",
  "foul_contact_not_visible",
  "free_throw_sequence_unclear",
  "other",
];

export type VideoIssue = {
  id: string;
  projectId: string;
  reportedBy?: string;
  reporterName: string;
  reporterRole: string;
  issueType: IssueType;
  severity: IssueSeverity;
  timestampSeconds?: number;
  period?: string;
  description?: string;
  createdAt: string;
};

type VideoIssueRow = {
  id: string;
  project_id: string;
  reported_by: string | null;
  reporter_name: string;
  reporter_role: string;
  issue_type: IssueType;
  severity: IssueSeverity;
  timestamp_seconds: number | null;
  period: string | null;
  description: string | null;
  created_at: string;
};

function mapRow(row: VideoIssueRow): VideoIssue {
  return {
    id: row.id,
    projectId: row.project_id,
    reportedBy: row.reported_by ?? undefined,
    reporterName: row.reporter_name,
    reporterRole: row.reporter_role,
    issueType: row.issue_type,
    severity: row.severity,
    timestampSeconds: row.timestamp_seconds ?? undefined,
    period: row.period ?? undefined,
    description: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getVideoIssues(projectId: string): Promise<VideoIssue[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("video_issues")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as VideoIssueRow[]).map(mapRow);
}

export type NewVideoIssueInput = {
  reporterName: string;
  reporterRole: string;
  issueType: IssueType;
  severity: IssueSeverity;
  timestampSeconds?: number;
  period?: string;
  description?: string;
};

export async function reportVideoIssue(
  projectId: string,
  input: NewVideoIssueInput
): Promise<{ ok: true; issue: VideoIssue } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("video_issues")
    .insert({
      project_id: projectId,
      reported_by: user?.id ?? null,
      reporter_name: input.reporterName,
      reporter_role: input.reporterRole,
      issue_type: input.issueType,
      severity: input.severity,
      timestamp_seconds: input.timestampSeconds ?? null,
      period: input.period ?? null,
      description: input.description ?? null,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, issue: mapRow(data as VideoIssueRow) };
}

export async function deleteVideoIssue(issueId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("video_issues").delete().eq("id", issueId);
}
