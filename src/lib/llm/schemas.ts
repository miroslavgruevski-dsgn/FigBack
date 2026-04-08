import { z } from "zod";

export const classificationSchema = z.object({
  elementTarget: z.string().describe("UI element or area the comment refers to"),
  issueType: z
    .enum(["bug", "ux", "visual", "copy", "accessibility", "question", "praise", "other"])
    .describe("Category of the feedback"),
  actionability: z
    .enum(["actionable", "needs_clarification", "informational"])
    .describe("Whether the comment requires action"),
  suggestedAction: z.string().describe("Concise recommended next step"),
  needsClarify: z.boolean().describe("Whether clarification is needed from the commenter"),
  ambiguityReason: z
    .string()
    .nullable()
    .describe("If needsClarify, explain what is unclear"),
  priorityHint: z
    .enum(["critical", "high", "medium", "low"])
    .describe("Suggested priority based on impact and scope"),
});

export type Classification = z.infer<typeof classificationSchema>;

export const executiveSummarySchema = z.object({
  summary: z.string().describe("2-3 sentence overview of all feedback"),
  topIssues: z
    .array(z.string())
    .max(5)
    .describe("Most important issues to address first"),
  sentiment: z
    .enum(["positive", "mixed", "negative"])
    .describe("Overall sentiment of the feedback"),
  keyThemes: z
    .array(z.string())
    .max(5)
    .describe("Recurring themes across comments"),
});

export type ExecutiveSummary = z.infer<typeof executiveSummarySchema>;
