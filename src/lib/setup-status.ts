import { prisma } from "@/lib/db";

type CheckState = "ok" | "missing" | "error";

export type SetupStatus = {
  ready: boolean;
  checks: {
    database: CheckState;
    auth: CheckState;
    figma: CheckState;
    llm: CheckState;
    cron: CheckState;
  };
};

function hasAuthEnv(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET &&
      process.env.AUTH_SECRET
  );
}

function hasLlmEnv(): boolean {
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY
  );
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const checks: SetupStatus["checks"] = {
    database: "missing",
    auth: hasAuthEnv() ? "ok" : "missing",
    figma: process.env.FIGMA_ACCESS_TOKEN ? "ok" : "missing",
    llm: hasLlmEnv() ? "ok" : "missing",
    cron: process.env.CRON_SECRET ? "ok" : "missing",
  };

  if (!process.env.DATABASE_URL) {
    return { ready: false, checks };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
    return { ready: false, checks };
  }

  try {
    const config = await prisma.teamConfig.findUnique({
      where: { id: "default" },
      select: { figmaAccessToken: true, llmApiKey: true, skipLlm: true },
    });
    if (config?.figmaAccessToken) checks.figma = "ok";
    if (config?.skipLlm || config?.llmApiKey) checks.llm = "ok";
  } catch {
    // Keep env-based checks as fallback when TeamConfig is unavailable.
  }

  const ready = Object.values(checks).every((value) => value === "ok");
  return { ready, checks };
}
