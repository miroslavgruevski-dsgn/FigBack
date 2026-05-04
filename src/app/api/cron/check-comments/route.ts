import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncProject } from "@/lib/figma/sync";
import { sendPushToAll } from "@/lib/push/send";
import { postSlackWatchOverview } from "@/lib/integrations/slack";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.teamConfig.findUnique({ where: { id: "default" } });
  if (config && !config.cronEnabled) {
    return NextResponse.json({ message: "Cron disabled" });
  }

  const projects = await prisma.project.findMany({
    where: { archived: false },
    select: { id: true, name: true },
  });

  const watchLines: {
    name: string;
    id: string;
    newCommentRows: number;
    syncErrors: string[];
  }[] = [];
  const errors: string[] = [];

  for (const project of projects) {
    const lineSyncErrors: string[] = [];
    let newCommentRows = 0;
    try {
      const result = await syncProject(project.id, "watch");
      newCommentRows = result.newComments;
      for (const e of result.errors) {
        lineSyncErrors.push(e);
        errors.push(`${project.name}: ${e}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lineSyncErrors.push(msg);
      errors.push(`${project.name}: ${msg}`);
    }
    watchLines.push({
      name: project.name,
      id: project.id,
      newCommentRows,
      syncErrors: lineSyncErrors,
    });
  }

  const synced = watchLines.length;

  if (config) {
    await prisma.teamConfig.update({
      where: { id: "default" },
      data: { lastCronRunAt: new Date() },
    });

    const anyNew = watchLines.some((l) => l.newCommentRows > 0);
    if (synced > 0 && config.notifyNewComments && anyNew) {
      await sendPushToAll({
        title: "New Figma comments synced",
        body: `${watchLines.filter((l) => l.newCommentRows > 0).length} project(s) have new rows`,
        url: "/",
      });
    }

    if (synced > 0 && config.autoPostSlack && config.slackWebhookUrl) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const slackResult = await postSlackWatchOverview(
        config.slackWebhookUrl,
        watchLines.map((p) => ({
          name: p.name,
          url: `${appUrl}/project/${p.id}`,
          newCommentRows: p.newCommentRows,
          syncErrors: p.syncErrors.length ? p.syncErrors : undefined,
        }))
      );
      if (!slackResult.ok) {
        await prisma.teamConfig.update({
          where: { id: "default" },
          data: {
            lastIntegrationError: slackResult.error ?? "Slack post failed",
            lastIntegrationErrorAt: new Date(),
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, synced, errors });
}
