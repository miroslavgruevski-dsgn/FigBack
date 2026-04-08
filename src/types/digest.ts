export type Priority = "critical" | "high" | "medium" | "low";

export type IssueStatus = "open" | "in_progress" | "done" | "dismissed";

export type EffortEstimate = "small" | "medium" | "large";

export type JobType =
  | "sync_watch"
  | "sync_full"
  | "export_images"
  | "classify"
  | "cluster";

export type JobStatus = "pending" | "waiting" | "running" | "done" | "failed";

export type LlmProvider = "google" | "openai" | "anthropic";
