import { NextRequest, NextResponse } from "next/server";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { getNextPendingJob, claimJob, completeJob, failJob } from "@/lib/jobs";

/** Full sync + classify + cluster can exceed 60s; Vercel caps at plan max (often 300s). */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isCsrfOriginAllowed(req)) {
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
        const { syncProject } = await import("@/lib/figma/sync");
        const mode = job.type === "sync_full" ? "full" : "watch";
        const syncResult = await syncProject(payload.projectId, mode, payload.roundId);
        if (syncResult.errors.length > 0) {
          const { logger } = await import("@/lib/logger");
          logger.error("Sync errors", { projectId: payload.projectId, errors: syncResult.errors });
        }
        break;
      }

      case "export_images": {
        try {
          const { getFigmaToken } = await import("@/lib/figma/token");
          const { exportFrameImages } = await import("@/lib/figma/export-images");
          const token = await getFigmaToken(payload.projectId);
          const files = await prisma.figmaFile.findMany({
            where: { projectId: payload.projectId },
            include: {
              comments: {
                where: { parentId: null, nodeId: { not: null } },
                select: { id: true, nodeId: true, frameId: true },
              },
            },
          });

          const allImageUrls = new Map<string, string>();

          for (const file of files) {
            const nodeIds = [...new Set(
              file.comments.map((c) => c.nodeId).filter((id): id is string => id !== null)
            )];

            if (nodeIds.length > 0) {
              const urls = await exportFrameImages(file.fileKey, nodeIds, token);
              for (const [nodeId, url] of urls) {
                if (url) allImageUrls.set(nodeId, url);
              }
            }

            const frameIdsToFetch = new Set<string>();
            for (const c of file.comments) {
              if (!c.frameId || !c.nodeId) continue;
              if (!allImageUrls.get(c.nodeId)) {
                frameIdsToFetch.add(c.frameId);
              }
            }

            if (frameIdsToFetch.size > 0) {
              const frameUrls = await exportFrameImages(file.fileKey, [...frameIdsToFetch], token);
              for (const [fid, url] of frameUrls) {
                if (url) allImageUrls.set(fid, url);
              }
            }
          }

          if (payload.roundId) {
            const cards = await prisma.reviewCard.findMany({
              where: { roundId: payload.roundId },
              include: { comment: { select: { nodeId: true, frameId: true } } },
            });

            for (const card of cards) {
              const nodeId = card.comment.nodeId;
              const frameId = card.comment.frameId;
              let url: string | undefined;
              if (nodeId) url = allImageUrls.get(nodeId);
              if (!url && frameId) url = allImageUrls.get(frameId);
              if (url) {
                await prisma.reviewCard.update({
                  where: { id: card.id },
                  data: { fullFrameUrl: url },
                });
              }
            }
          }
        } catch (err) {
          const { logger } = await import("@/lib/logger");
          logger.error("Export images failed (non-critical)", {
            error: err instanceof Error ? err.message : String(err),
          });
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
        });

        const { classifyCard } = await import("@/lib/llm/classify");
        const llmOpts = {
          provider: config?.llmProvider,
          model: config?.llmModel,
          apiKey: config?.llmApiKey,
        };

        const concurrency = 5;
        for (let i = 0; i < cards.length; i += concurrency) {
          const batch = cards.slice(i, i + concurrency);
          const results = await Promise.allSettled(
            batch.map((card) =>
              classifyCard(
                {
                  commentText: card.comment.message,
                  authorName: card.comment.authorName,
                  frameName: card.frameName,
                  pageName: card.pageName,
                },
                llmOpts
              ).then(async (result) => {
                await prisma.lLMAssessment.create({
                  data: { cardId: card.id, ...result },
                });
              })
            )
          );
          for (const r of results) {
            if (r.status === "rejected") {
              const { logger } = await import("@/lib/logger");
              logger.error("Classification failed", { error: String(r.reason) });
            }
          }
        }
        break;
      }

      case "cluster": {
        if (!payload.roundId) break;
        const { clusterCards } = await import("@/lib/digest/cluster");
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
                const { generateExecutiveSummary } = await import("@/lib/llm/summary");
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
              const { postSlackDigest } = await import("@/lib/integrations/slack");
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
                await prisma.teamConfig.update({
                  where: { id: "default" },
                  data: {
                    lastIntegrationError: `Slack: ${slackResult.error ?? "post failed"}`,
                    lastIntegrationErrorAt: new Date(),
                  },
                }).catch(() => {});
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

              const { pushToConfluence } = await import("@/lib/integrations/confluence");
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
                await prisma.teamConfig.update({
                  where: { id: "default" },
                  data: {
                    lastIntegrationError: `Confluence: ${confResult.error ?? "push failed"}`,
                    lastIntegrationErrorAt: new Date(),
                  },
                }).catch(() => {});
              }
            }

            if (integrationConfig.notifySyncComplete) {
              const { sendPushToAll } = await import("@/lib/push/send");
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
