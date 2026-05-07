import { generateObject } from "ai";
import { resolveModel, getProviderConfig } from "./provider";
import { executiveSummarySchema, type ExecutiveSummary } from "./schemas";
import { LlmError } from "@/lib/errors";
import type { Classification } from "./schemas";

interface SummaryInput {
  projectName: string;
  totalComments: number;
  classifications: {
    comment: string;
    frameName: string;
    classification: Classification;
  }[];
}

export async function generateExecutiveSummary(
  input: SummaryInput,
  options?: { provider?: string | null; model?: string | null; apiKey?: string | null }
): Promise<ExecutiveSummary> {
  const config = getProviderConfig(options?.provider, options?.model, options?.apiKey);
  const model = await resolveModel(config);

  const issueBreakdown = input.classifications.reduce(
    (acc, c) => {
      acc[c.classification.issueType] = (acc[c.classification.issueType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const prompt = `Generate an executive summary for design feedback on "${input.projectName}".

Total comments: ${input.totalComments}
Issue breakdown: ${JSON.stringify(issueBreakdown)}

Top comments by priority:
${input.classifications
  .sort((a, b) => priorityOrder(a.classification.priorityHint) - priorityOrder(b.classification.priorityHint))
  .slice(0, 15)
  .map((c) => `- [${c.classification.priorityHint}] ${c.classification.issueType}: "${c.comment}" (${c.frameName})`)
  .join("\n")}

Provide a concise executive summary.`;

  try {
    const { object } = await generateObject({
      model,
      schema: executiveSummarySchema,
      messages: [
        {
          role: "system",
          content: "You are a design review assistant summarizing feedback for a design team lead.",
        },
        { role: "user", content: prompt },
      ],
    });
    return object;
  } catch (err) {
    throw new LlmError(
      err instanceof Error ? err.message : String(err),
      config.provider
    );
  }
}

export function buildHeuristicExecutiveSummary(input: SummaryInput): ExecutiveSummary {
  const sorted = [...input.classifications].sort(
    (a, b) => priorityOrder(a.classification.priorityHint) - priorityOrder(b.classification.priorityHint)
  );
  const top = sorted.slice(0, 5);

  const issues = input.classifications.reduce<Record<string, number>>((acc, c) => {
    acc[c.classification.issueType] = (acc[c.classification.issueType] ?? 0) + 1;
    return acc;
  }, {});

  const themes = Object.entries(issues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  const highCount = input.classifications.filter((c) =>
    c.classification.priorityHint === "critical" || c.classification.priorityHint === "high"
  ).length;

  const sentiment: ExecutiveSummary["sentiment"] =
    highCount >= Math.max(2, Math.ceil(input.totalComments * 0.25))
      ? "negative"
      : highCount > 0
        ? "mixed"
        : "positive";

  const summary =
    `Processed ${input.totalComments} comments across ${themes.length || 1} main theme${themes.length === 1 ? "" : "s"}. ` +
    (highCount > 0
      ? `${highCount} item${highCount === 1 ? "" : "s"} are marked high priority and should be addressed first.`
      : "Most feedback is medium/low priority and can be handled in routine design iterations.");

  return {
    summary,
    topIssues: top.map(
      (c) => `[${c.classification.priorityHint}] ${c.classification.issueType}: ${c.comment.slice(0, 90)}`
    ),
    sentiment,
    keyThemes: themes,
  };
}

function priorityOrder(p: string): number {
  switch (p) {
    case "critical": return 0;
    case "high": return 1;
    case "medium": return 2;
    case "low": return 3;
    default: return 4;
  }
}
