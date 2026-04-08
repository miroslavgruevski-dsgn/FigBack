import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncProject } from "@/lib/figma/sync";
import { sendPushToAll } from "@/lib/push/send";
import { postSlackSyncSummary } from "@/lib/integrations/slack";

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

  const syncedProjects: { name: string; id: string }[] = [];
  const errors: string[] = [];

  for (const project of projects) {
    try {
      await syncProject(project.id, "watch");
      syncedProjects.push(project);
    } catch (err) {
      errors.push(`${project.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const synced = syncedProjects.length;

  if (config) {
    await prisma.teamConfig.update({
      where: { id: "default" },
      data: { lastCronRunAt: new Date() },
    });

    if (synced > 0 && config.notifyNewComments) {
      await sendPushToAll({
        title: "Checking for new comments",
        body: `Synced ${synced} project${synced !== 1 ? "s" : ""} with Figma`,
        url: "/",
      });
    }

    if (synced > 0 && config.autoPostSlack && config.slackWebhookUrl) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await postSlackSyncSummary(
        config.slackWebhookUrl,
        syncedProjects.map((p) => ({ name: p.name, url: `${appUrl}/project/${p.id}` }))
      ).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, synced, errors });
}
