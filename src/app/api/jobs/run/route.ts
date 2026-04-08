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
  // #region agent log
  fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:21',message:'getNextPendingJob result',data:{hasJob:!!job,jobId:job?.id,jobType:job?.type,jobStatus:job?.status,jobCreatedAt:job?.createdAt},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:34',message:'claimJob result',data:{claimed:!!claimed,jobId:job.id,jobType:job.type},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!claimed) {
      return NextResponse.json({ message: "jobs_running", runningType: job.type });
    }
    const payload = job.payload as Record<string, string>;

    switch (job.type) {
      case "sync_watch":
      case "sync_full": {
        const { syncProject } = await import("@/lib/figma/sync");
        const mode = job.type === "sync_full" ? "full" : "watch";
        // #region agent log
        fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:sync_full',message:'starting sync',data:{projectId:payload.projectId,roundId:payload.roundId,mode},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const syncResult = await syncProject(payload.projectId, mode, payload.roundId);
        // #region agent log
        fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:sync_done',message:'sync completed',data:{errors:syncResult.errors,newComments:syncResult.newComments},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (syncResult.errors.length > 0) {
          const { logger } = await import("@/lib/logger");
          logger.error("Sync errors", { projectId: payload.projectId, errors: syncResult.errors });
        }
        break;
      }

      case "export_images": {
        const { getFigmaToken } = await import("@/lib/figma/token");
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
            const { exportFrameImages } = await import("@/lib/figma/export-images");
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
            const { classifyCard } = await import("@/lib/llm/classify");
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
    const errStack = err instanceof Error ? err.stack : undefined;
    const errName = err instanceof Error ? err.name : undefined;
    const errCode = (err as Record<string, unknown>)?.code;
    // #region agent log
    fetch('http://127.0.0.1:7755/ingest/39e64033-6f89-4c17-bd62-9468c340b463',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'834cbc'},body:JSON.stringify({sessionId:'834cbc',location:'jobs/run/route.ts:catch',message:'JOB FAILED',data:{jobId:job.id,jobType:job.type,errorMessage:message,errorName:errName,errorCode:errCode,errorStack:errStack?.slice(0,500)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await failJob(job.id, message);
    return NextResponse.json({ jobId: job.id, type: job.type, status: "failed", error: message }, { status: 500 });
  }
}
