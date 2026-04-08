import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNextPendingJob, claimJob, completeJob, failJob } from "@/lib/jobs";
import { syncProject } from "@/lib/figma/sync";
import { exportFrameImages } from "@/lib/figma/export-images";
import { getFigmaToken } from "@/lib/figma/token";
import { classifyCard } from "@/lib/llm/classify";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const job = await getNextPendingJob();
  if (!job) {
    return NextResponse.json({ message: "No pending jobs" });
  }

  try {
    await claimJob(job.id);
    const payload = job.payload as Record<string, string>;

    switch (job.type) {
      case "sync_watch":
      case "sync_full": {
        const mode = job.type === "sync_full" ? "full" : "watch";
        await syncProject(payload.projectId, mode);
        break;
      }

      case "export_images": {
        const token = await getFigmaToken(payload.projectId);
        const files = await prisma.figmaFile.findMany({
          where: { projectId: payload.projectId },
          include: {
            comments: {
              where: { processed: false, parentId: null, frameId: { not: null } },
              select: { frameId: true, fileId: true },
            },
          },
        });

        for (const file of files) {
          const frameIds = file.comments
            .map((c) => c.frameId)
            .filter((id): id is string => id !== null);

          if (frameIds.length > 0) {
            await exportFrameImages(file.fileKey, frameIds, token);
          }
        }
        break;
      }

      case "classify": {
        const config = await prisma.teamConfig.findUnique({ where: { id: "default" } });
        if (config?.skipLlm) break;

        const cards = await prisma.reviewCard.findMany({
          where: {
            round: { projectId: payload.projectId },
            assessment: null,
          },
          include: { comment: true },
          take: 20,
        });

        for (const card of cards) {
          try {
            const result = await classifyCard(
              {
                commentText: card.comment.message,
                authorName: card.comment.authorName,
                frameName: card.frameName,
                pageName: card.pageName,
              },
              {
                provider: config?.llmProvider,
                model: config?.llmModel,
                apiKey: config?.llmApiKey,
              }
            );

            await prisma.lLMAssessment.create({
              data: {
                cardId: card.id,
                ...result,
              },
            });
          } catch (err) {
            const { logger } = await import("@/lib/logger");
            logger.error("Classification failed", { cardId: card.id, error: err instanceof Error ? err.message : String(err) });
          }
        }
        break;
      }

      case "cluster":
        // Phase 4
        break;
    }

    await completeJob(job.id);
    return NextResponse.json({ jobId: job.id, status: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    return NextResponse.json({ jobId: job.id, status: "failed", error: message }, { status: 500 });
  }
}
