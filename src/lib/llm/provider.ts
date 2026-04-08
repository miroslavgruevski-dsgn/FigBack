import type { LanguageModel } from "ai";
import type { LlmProvider } from "@/types/digest";

interface ProviderConfig {
  provider: LlmProvider;
  model: string;
  apiKey?: string | null;
}

const defaultModels: Record<LlmProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
};

const envKeys: Record<LlmProvider, string> = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export async function resolveModel(config: ProviderConfig): Promise<LanguageModel> {
  const { provider, model, apiKey } = config;
  const key = apiKey || process.env[envKeys[provider]] || undefined;

  switch (provider) {
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey: key })(model || defaultModels.google);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey: key })(model || defaultModels.openai);
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey: key })(model || defaultModels.anthropic);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

export function getProviderConfig(
  dbProvider?: string | null,
  dbModel?: string | null,
  dbApiKey?: string | null
): ProviderConfig {
  const provider = (dbProvider || detectAvailableProvider()) as LlmProvider;
  const model = dbModel || defaultModels[provider];
  return { provider, model, apiKey: dbApiKey };
}

function detectAvailableProvider(): LlmProvider {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "google";
}

export function getProviderDisplayName(provider: LlmProvider): string {
  switch (provider) {
    case "google":
      return "Google Gemini";
    case "openai":
      return "OpenAI GPT";
    case "anthropic":
      return "Anthropic Claude";
    default: {
      const _exhaustive: never = provider;
      return String(_exhaustive);
    }
  }
}
