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
import { sendPushToAll } from "@/lib/push/send";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const job = await getNextPendingJob();
  if (!job) {
    const running = await prisma.job.findFirst({
      where: { status: "running" },
      select: { type: true },
    });
    if (running) {
      return NextResponse.json({ message: "jobs_running", runningType: running.type });
    }
    return NextResponse.json({ message: "all_done" });
  }

  try {
    const claimed = await claimJob(job.id);
    if (!claimed) {
      return NextResponse.json({ message: "jobs_running", runningType: job.type });
    }
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
              where: { parentId: null, frameId: { not: null } },
              select: { id: true, frameId: true },
            },
          },
        });

        const allImageUrls = new Map<string, string>();

        for (const file of files) {
          const frameIds = file.comments
            .map((c) => c.frameId)
            .filter((id): id is string => id !== null);

          if (frameIds.length > 0) {
            const urls = await exportFrameImages(file.fileKey, frameIds, token);
            for (const [nodeId, url] of urls) {
              allImageUrls.set(nodeId, url);
            }
          }
        }

        if (allImageUrls.size > 0 && payload.roundId) {
          const cards = await prisma.reviewCard.findMany({
            where: { roundId: payload.roundId },
            include: { comment: { select: { frameId: true } } },
          });

          for (const card of cards) {
            const frameId = card.comment.frameId;
            if (frameId && allImageUrls.has(frameId)) {
              await prisma.reviewCard.update({
                where: { id: card.id },
                data: { fullFrameUrl: allImageUrls.get(frameId) },
              });
            }
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
              const slackResult = await postSlackDigest(integrationConfig.slackWebhookUrl, {
                projectName: finalRound.project.name,
                roundName: finalRound.name ?? "Analysis",
                totalComments: finalRound.commentCount,
                totalClusters: finalRound.clusters.length,
                criticalCount,
                digestUrl,
                topIssues,
              });
              if (!slackResult.ok) {
                const { logger } = await import("@/lib/logger");
                logger.error("Slack digest post failed", { roundId: payload.roundId, error: slackResult.error });
              }
            }

            if (
              integrationConfig.autoPostConfluence &&
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

              const confResult = await pushToConfluence(
                {
                  baseUrl: integrationConfig.confluenceBaseUrl,
                  email: integrationConfig.confluenceEmail,
                  token: integrationConfig.confluenceToken,
                  spaceKey: integrationConfig.confluenceSpaceKey,
                  parentId: integrationConfig.confluenceParentId,
                },
                {
                  title: `FigBack: ${finalRound.project.name} \u2014 ${finalRound.name ?? "Analysis"}`,
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
              if (!confResult.ok) {
                const { logger } = await import("@/lib/logger");
                logger.error("Confluence push failed", { roundId: payload.roundId, error: confResult.error });
              }
            }

            if (integrationConfig.notifySyncComplete) {
              await sendPushToAll({
                title: `Analysis complete: ${finalRound.project.name}`,
                body: `${finalRound.clusters.length} issue${finalRound.clusters.length !== 1 ? "s" : ""} found${criticalCount > 0 ? ` (${criticalCount} critical)` : ""}`,
                url: digestUrl,
              });
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

    const next = await getNextPendingJob();
    return NextResponse.json({
      jobId: job.id,
      type: job.type,
      status: "done",
      hasMore: !!next,
      nextType: next?.type ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    return NextResponse.json({ jobId: job.id, type: job.type, status: "failed", error: message }, { status: 500 });
  }
}
