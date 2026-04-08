import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  IMAGE_SIGN_SECRET: z.string().min(1),
});

export function validateEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => i.path.join("."))
      .join(", ");
    console.error(`[env] Missing required env vars: ${missing}`);
  }
}

export function hasLlmKey(): boolean {
  return !!(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY
  );
}

export function detectedLlmProvider(): "google" | "openai" | "anthropic" | null {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}
