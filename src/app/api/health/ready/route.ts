import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Readiness: dependencies required for normal operation.
 * Includes optional queue depth for alerting (does not flip `ready` on backlog alone).
 */
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

  let queuePending = 0;

  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
      const now = new Date();
      queuePending = await prisma.job.count({
        where: {
          status: { in: ["pending", "running", "waiting"] },
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
      });
    } catch {
      checks.database = "error";
    }
  }

  const ready = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      ready,
      checks,
      queue: { activeOrDue: queuePending },
    },
    { status: ready ? 200 : 503 }
  );
}
