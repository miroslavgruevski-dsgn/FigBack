import { NextRequest, NextResponse } from "next/server";
import { canManageSettings, requireApiSession } from "@/lib/api-guards";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { testSlackWebhook } from "@/lib/integrations/slack";

export async function POST(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;
  if (!canManageSettings(guard.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const config = await prisma.teamConfig.findUnique({ where: { id: "default" } });
  if (!config?.slackWebhookUrl) {
    return NextResponse.json({ ok: false, error: "Slack webhook URL is not configured" }, { status: 400 });
  }

  const result = await testSlackWebhook(config.slackWebhookUrl);
  if (!result.ok) {
    await prisma.teamConfig
      .update({
        where: { id: "default" },
        data: {
          lastIntegrationError: `Slack: ${result.error ?? "preflight failed"}`,
          lastIntegrationErrorAt: new Date(),
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
