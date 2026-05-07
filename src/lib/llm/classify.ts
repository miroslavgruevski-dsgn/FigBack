import { generateObject } from "ai";
import { resolveModel, getProviderConfig } from "./provider";
import { classificationSchema, type Classification } from "./schemas";
import { LlmError } from "@/lib/errors";

interface ClassifyInput {
  commentText: string;
  authorName: string;
  frameName: string;
  pageName: string;
  replies?: string[];
  imageUrl?: string;
}

interface ClassifyOptions {
  provider?: string | null;
  model?: string | null;
  apiKey?: string | null;
  includeImage?: boolean;
}

export type ClassificationSource = "llm" | "heuristic";

export async function classifyCard(
  input: ClassifyInput,
  options: ClassifyOptions = {}
): Promise<Classification> {
  const config = getProviderConfig(options.provider, options.model, options.apiKey);
  const model = await resolveModel(config);

  const prompt = buildPrompt(input);
  const messages: Parameters<typeof generateObject>[0]["messages"] = [
    {
      role: "system",
      content:
        "You are a design review assistant. Classify Figma comments into structured feedback. Be concise and actionable.",
    },
    {
      role: "user",
      content: options.includeImage && input.imageUrl
        ? [
            { type: "text" as const, text: prompt },
            { type: "image" as const, image: new URL(input.imageUrl) },
          ]
        : prompt,
    },
  ];

  try {
    const { object } = await generateObject({
      model,
      schema: classificationSchema,
      messages,
    });
    return object;
  } catch (err) {
    throw new LlmError(
      err instanceof Error ? err.message : String(err),
      config.provider,
      isRetryable(err)
    );
  }
}

export function classifyWithHeuristics(input: ClassifyInput): Classification {
  const text = `${input.commentText} ${(input.replies ?? []).join(" ")}`.toLowerCase();
  const frame = input.frameName?.trim() || "Unknown";

  const issueType: Classification["issueType"] =
    /(typo|copy|wording|text|grammar)/.test(text)
      ? "copy"
      : /(contrast|accessib|a11y|screen reader|keyboard)/.test(text)
        ? "accessibility"
        : /(bug|broken|crash|error|doesn.t work|fails?)/.test(text)
          ? "bug"
          : /(spacing|align|layout|visual|color|font|padding|margin)/.test(text)
            ? "visual"
            : /(confus|unclear|difficult|hard to|ux)/.test(text)
              ? "ux"
              : /\?/.test(text)
                ? "question"
                : /(great|nice|love|good job|looks good)/.test(text)
                  ? "praise"
                  : "other";

  const priorityHint: Classification["priorityHint"] =
    /(critical|urgent|blocker|cannot|can.t|broken|crash|error)/.test(text)
      ? "high"
      : /(important|major|inconsistent|confus|unclear)/.test(text)
        ? "medium"
        : "low";

  const needsClarify =
    issueType === "question" || /(what do you mean|not sure|unclear exactly)/.test(text);

  const actionability: Classification["actionability"] =
    issueType === "praise"
      ? "informational"
      : needsClarify
        ? "needs_clarification"
        : "actionable";

  const suggestedAction =
    issueType === "copy"
      ? `Review and update the copy in ${frame}.`
      : issueType === "accessibility"
        ? `Audit accessibility in ${frame} and adjust semantics, contrast, and keyboard behavior.`
        : issueType === "bug"
          ? `Investigate the reported bug in ${frame} and ship a fix.`
          : issueType === "visual"
            ? `Align visual styling in ${frame} with the design system.`
            : issueType === "ux"
              ? `Improve clarity and interaction flow in ${frame}.`
              : issueType === "question"
                ? `Reply to clarify the question and confirm expected behavior in ${frame}.`
                : issueType === "praise"
                  ? `No immediate action required. Capture this as positive feedback for ${frame}.`
                  : `Review this feedback in ${frame} and decide next steps.`;

  return {
    elementTarget: frame,
    issueType,
    actionability,
    suggestedAction,
    needsClarify,
    ambiguityReason: needsClarify
      ? "The comment lacks enough detail to implement confidently."
      : null,
    priorityHint,
  };
}

export function estimateClassificationConfidence(
  source: ClassificationSource,
  result: Classification
): number | null {
  if (source === "heuristic") {
    if (result.needsClarify) return 0.35;
    if (result.priorityHint === "high" || result.priorityHint === "critical") return 0.55;
    return 0.5;
  }
  if (result.needsClarify) return 0.58;
  if (result.priorityHint === "high" || result.priorityHint === "critical") return 0.78;
  return 0.72;
}

function buildPrompt(input: ClassifyInput): string {
  let prompt = `Classify this Figma design comment:\n\n`;
  prompt += `Page: ${input.pageName}\n`;
  prompt += `Frame: ${input.frameName}\n`;
  prompt += `Author: ${input.authorName}\n`;
  prompt += `Comment: "${input.commentText}"\n`;

  if (input.replies && input.replies.length > 0) {
    prompt += `\nReplies:\n`;
    input.replies.forEach((r, i) => {
      prompt += `  ${i + 1}. "${r}"\n`;
    });
  }

  return prompt;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("timeout") ||
      msg.includes("503") ||
      msg.includes("429")
    );
  }
  return true;
}

export async function batchClassify(
  inputs: { input: ClassifyInput; cardId: string }[],
  options: ClassifyOptions = {}
): Promise<Map<string, Classification | Error>> {
  const results = new Map<string, Classification | Error>();

  for (const { input, cardId } of inputs) {
    try {
      const classification = await classifyCard(input, options);
      results.set(cardId, classification);
    } catch (err) {
      results.set(cardId, err instanceof Error ? err : new Error(String(err)));
    }

    // Brief delay between calls to respect rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}
