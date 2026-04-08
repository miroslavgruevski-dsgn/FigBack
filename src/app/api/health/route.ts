import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, "ok" | "missing" | "error"> = {
    figma: process.env.FIGMA_ACCESS_TOKEN ? "ok" : "missing",
    database: "missing",
    llm: (process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY)
      ? "ok"
      : "missing",
  };

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db");
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json({ healthy, checks }, { status: healthy ? 200 : 503 });
}
