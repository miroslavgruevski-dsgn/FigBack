import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createJob, hasActiveJob } from "@/lib/jobs";
import { sendPushToAll } from "@/lib/push/send";
import { postSlackSyncSummary } from "@/lib/integrations/slack";

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

  const queuedProjects: { name: string; id: string }[] = [];
  for (const project of projects) {
    const existing = await hasActiveJob(project.id, "sync_watch");
    if (existing) continue;

    await createJob("sync_watch", project.id, { projectId: project.id });
    queuedProjects.push(project);
  }

  const queued = queuedProjects.length;

  if (config) {
    await prisma.teamConfig.update({
      where: { id: "default" },
      data: { lastCronRunAt: new Date() },
    });

    if (queued > 0 && config.notifyNewComments) {
      await sendPushToAll({
        title: "Checking for new comments",
        body: `Syncing ${queued} project${queued !== 1 ? "s" : ""} with Figma`,
        url: "/",
      });
    }

    if (queued > 0 && config.autoPostSlack && config.slackWebhookUrl) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await postSlackSyncSummary(
        config.slackWebhookUrl,
        queuedProjects.map((p) => ({ name: p.name, url: `${appUrl}/project/${p.id}` }))
      ).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, queued });
}
