import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  llmProvider: z.enum(["google", "openai", "anthropic"]).optional(),
  llmModel: z.string().nullable().optional(),
  llmApiKey: z.string().nullable().optional(),
  skipLlm: z.boolean().optional(),
  slackWebhookUrl: z.string().nullable().optional(),
  autoPostSlack: z.boolean().optional(),
  confluenceBaseUrl: z.string().nullable().optional(),
  confluenceEmail: z.string().nullable().optional(),
  confluenceToken: z.string().nullable().optional(),
  confluenceSpaceKey: z.string().nullable().optional(),
  confluenceParentId: z.string().nullable().optional(),
  autoPostConfluence: z.boolean().optional(),
  cronEnabled: z.boolean().optional(),
  notifyNewComments: z.boolean().optional(),
  notifySyncComplete: z.boolean().optional(),
  archiveDays: z.number().min(7).max(365).optional(),
  figmaAccessToken: z.string().nullable().optional(),
});

function redact(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}

export async function GET() {
  const config = await prisma.teamConfig.upsert({
    where: { id: "default" },
    create: {},
    update: {},
  });

  return NextResponse.json({
    ...config,
    figmaAccessToken: redact(config.figmaAccessToken),
    llmApiKey: redact(config.llmApiKey),
    confluenceToken: redact(config.confluenceToken),
    slackWebhookUrl: redact(config.slackWebhookUrl),
  });
}

export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const config = await prisma.teamConfig.upsert({
    where: { id: "default" },
    create: { ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json(config);
}
