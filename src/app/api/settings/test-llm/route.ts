import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { prisma } from "@/lib/db";
import { getProviderConfig, resolveModel } from "@/lib/llm/provider";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const config = await prisma.teamConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    return NextResponse.json({ error: "No team config" }, { status: 400 });
  }
  if (config.skipLlm) {
    return NextResponse.json({ ok: true, skipped: true as const });
  }

  const hasKey =
    !!config.llmApiKey ||
    (config.llmProvider === "google" && !!process.env.GOOGLE_GENERATIVE_AI_API_KEY) ||
    (config.llmProvider === "openai" && !!process.env.OPENAI_API_KEY) ||
    (config.llmProvider === "anthropic" && !!process.env.ANTHROPIC_API_KEY);

  if (!hasKey) {
    return NextResponse.json(
      { ok: false, error: "Add an API key in settings or set the provider env var." },
      { status: 400 }
    );
  }

  try {
    const pc = getProviderConfig(config.llmProvider, config.llmModel, config.llmApiKey);
    const model = await resolveModel(pc);
    await generateText({
      model,
      prompt: "Reply with exactly: ok",
    });
    return NextResponse.json({ ok: true as const });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false as const, error: msg }, { status: 422 });
  }
}
