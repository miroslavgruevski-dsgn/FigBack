import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNextPendingJob, claimJob, completeJob, failJob } from "@/lib/jobs";

export const maxDuration = 60;

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
          // #region agent log
          fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:export_images_start',message:'export_images job started',data:{projectId:payload.projectId,roundId:payload.roundId},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
          // #endregion
          const { getFigmaToken } = await import("@/lib/figma/token");
          const token = await getFigmaToken(payload.projectId);
          const files = await prisma.figmaFile.findMany({
            where: { projectId: payload.projectId },
            include: {
              comments: {
                where: { parentId: null, nodeId: { not: null } },
                select: { id: true, nodeId: true },
              },
            },
          });

          // #region agent log
          fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:files_fetched',message:'files and comments fetched',data:{fileCount:files.length,commentCounts:files.map(f=>({fileKey:f.fileKey,comments:f.comments.length,sampleNodeIds:f.comments.slice(0,3).map(c=>c.nodeId)}))},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
          // #endregion

          const allImageUrls = new Map<string, string>();

          for (const file of files) {
            const nodeIds = [...new Set(
              file.comments.map((c) => c.nodeId).filter((id): id is string => id !== null)
            )];

            if (nodeIds.length > 0) {
              const { exportFrameImages } = await import("@/lib/figma/export-images");
              const urls = await exportFrameImages(file.fileKey, nodeIds, token);
              // #region agent log
              fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:images_fetched',message:'figma image URLs fetched',data:{fileKey:file.fileKey,nodeIdCount:nodeIds.length,urlCount:urls.size,sampleUrl:[...urls.values()][0]?.slice(0,80)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
              // #endregion
              for (const [nodeId, url] of urls) {
                allImageUrls.set(nodeId, url);
              }
            }
          }

          // #region agent log
          fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:before_card_update',message:'about to update cards',data:{totalImageUrls:allImageUrls.size,hasRoundId:!!payload.roundId,roundId:payload.roundId},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
          // #endregion

          if (allImageUrls.size > 0 && payload.roundId) {
            const cards = await prisma.reviewCard.findMany({
              where: { roundId: payload.roundId },
              include: { comment: { select: { nodeId: true } } },
            });

            let matched = 0;
            for (const card of cards) {
              const nodeId = card.comment.nodeId;
              if (nodeId && allImageUrls.has(nodeId)) {
                await prisma.reviewCard.update({
                  where: { id: card.id },
                  data: { fullFrameUrl: allImageUrls.get(nodeId) },
                });
                matched++;
              }
            }
            // #region agent log
            fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:cards_updated',message:'cards updated with image URLs',data:{totalCards:cards.length,matchedCards:matched},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
            // #endregion
          }
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:export_images_error',message:'export_images failed',data:{error:err instanceof Error ? err.message : String(err)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
          // #endregion
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
