import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNextPendingJob, claimJob, completeJob, failJob } from "@/lib/jobs";
import { syncProject } from "@/lib/figma/sync";
import { exportFrameImages } from "@/lib/figma/export-images";
import { getFigmaToken } from "@/lib/figma/token";
import { classifyCard } from "@/lib/llm/classify";
import { clusterCards } from "@/lib/digest/cluster";
import { generateExecutiveSummary } from "@/lib/llm/summary";
import { postSlackDigest } from "@/lib/integrations/slack";
import { pushToConfluence } from "@/lib/integrations/confluence";

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
        await syncProject(payload.projectId, mode, payload.roundId);
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

      case "cluster": {
        if (!payload.roundId) break;
        await clusterCards(payload.roundId);

        const config2 = await prisma.teamConfig.findUnique({ where: { id: "default" } });
        if (!config2?.skipLlm) {
          try {
            const roundData = await prisma.reviewRound.findUnique({
              where: { id: payload.roundId },
              include: {
                project: { select: { name: true } },
                cards: {
                  include: {
                    comment: { select: { message: true } },
                    assessment: true,
                  },
                },
              },
            });

            if (roundData && roundData.cards.length > 0) {
              const classified = roundData.cards
                .filter((c) => c.assessment)
                .map((c) => ({
                  comment: c.comment.message,
                  frameName: c.frameName,
                  classification: c.assessment! as unknown as import("@/lib/llm/schemas").Classification,
                }));

              if (classified.length > 0) {
                const summary = await generateExecutiveSummary(
                  {
                    projectName: roundData.project.name,
                    totalComments: roundData.commentCount,
                    classifications: classified,
                  },
                  { provider: config2?.llmProvider, model: config2?.llmModel }
                );

                await prisma.reviewRound.update({
                  where: { id: payload.roundId },
                  data: { executiveSummary: JSON.stringify(summary) },
                });
              }
            }
          } catch (err) {
            const { logger } = await import("@/lib/logger");
            logger.error("Executive summary failed", {
              roundId: payload.roundId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        // Post-analysis integrations
        try {
          const integrationConfig = config2 ?? await prisma.teamConfig.findUnique({ where: { id: "default" } });
          const finalRound = await prisma.reviewRound.findUnique({
            where: { id: payload.roundId },
            include: {
              project: { select: { name: true } },
              clusters: {
                include: {
                  cards: { include: { assessment: { select: { priorityHint: true } } } },
                },
              },
            },
          });

          if (finalRound && integrationConfig) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const digestUrl = `${baseUrl}/project/${payload.projectId}/digest?roundId=${payload.roundId}`;
            const criticalCount = finalRound.clusters.filter((c) =>
              c.cards.some((card) => card.assessment?.priorityHint === "critical")
            ).length;
            const topIssues = finalRound.clusters.slice(0, 5).map((c) => ({
              title: c.title,
              priority: c.cards.find((card) => card.assessment)?.assessment?.priorityHint ?? "medium",
            }));

            if (integrationConfig.autoPostSlack && integrationConfig.slackWebhookUrl) {
              await postSlackDigest(integrationConfig.slackWebhookUrl, {
                projectName: finalRound.project.name,
                roundName: finalRound.name ?? "Analysis",
                totalComments: finalRound.commentCount,
                totalClusters: finalRound.clusters.length,
                criticalCount,
                digestUrl,
                topIssues,
              });
            }

            if (
              integrationConfig.confluenceBaseUrl &&
              integrationConfig.confluenceEmail &&
              integrationConfig.confluenceToken &&
              integrationConfig.confluenceSpaceKey
            ) {
              let summaryText = "";
              if (finalRound.executiveSummary) {
                try {
                  const parsed = JSON.parse(finalRound.executiveSummary);
                  summaryText = parsed.summary ?? "";
                } catch { /* ignore */ }
              }

              await pushToConfluence(
                {
                  baseUrl: integrationConfig.confluenceBaseUrl,
                  email: integrationConfig.confluenceEmail,
                  token: integrationConfig.confluenceToken,
                  spaceKey: integrationConfig.confluenceSpaceKey,
                  parentId: integrationConfig.confluenceParentId,
                },
                {
                  title: `FigBack: ${finalRound.project.name} — ${finalRound.name ?? "Analysis"}`,
                  summary: summaryText,
                  clusters: finalRound.clusters.map((c) => ({
                    title: c.title,
                    summary: c.summary,
                    priority: c.cards[0]?.assessment?.priorityHint ?? "medium",
                    commentCount: c.cards.length,
                    status: c.status,
                  })),
                }
              );
            }
          }
        } catch (err) {
          const { logger } = await import("@/lib/logger");
          logger.error("Integration post-analysis failed", {
            roundId: payload.roundId,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        break;
      }
    }

    await completeJob(job.id);
    return NextResponse.json({ jobId: job.id, status: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    return NextResponse.json({ jobId: job.id, status: "failed", error: message }, { status: 500 });
  }
}
