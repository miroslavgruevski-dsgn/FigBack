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
