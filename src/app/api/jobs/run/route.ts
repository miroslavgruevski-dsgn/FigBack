import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import {
  createJob,
  createJobChain,
  findQueuedJobByPayload,
  getNextPendingJob,
  claimJob,
  completeJob,
  failJob,
} from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { buildFigmaDeepLink, syncProject } from "@/lib/figma/sync";
import { FigmaApiError } from "@/lib/errors";
import type { JobType } from "@/types/digest";

/** Full sync + classify + cluster can exceed 60s; Vercel caps at plan max (often 300s). */
export const maxDuration = 300;

type JobPayload = Record<string, unknown>;

function asPayload(value: unknown): JobPayload {
  return value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function updateJobPayload(jobId: string, current: JobPayload, patch: JobPayload): Promise<JobPayload> {
  const next = { ...current, ...patch };
  await prisma.job.update({
    where: { id: jobId },
    data: { payload: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}

function progressLabel(payload: JobPayload): string | undefined {
  const stageLabel = asString(payload.stageLabel);
  if (stageLabel) return stageLabel;
  const current = asNumber(payload.progressCurrent, -1);
  const total = asNumber(payload.progressTotal, -1);
  if (current >= 0 && total > 0) {
    return `Processing ${current}/${total}`;
  }
  return undefined;
}

async function processExportImagesForFile(
  projectId: string,
  fileId: string,
  fileKey: string,
  roundId?: string
): Promise<{ cardsUpdated: number; uniqueImages: number }> {
  const { getFigmaToken } = await import("@/lib/figma/token");
  const { exportFrameImages } = await import("@/lib/figma/export-images");

  const token = await getFigmaToken(projectId);
  const comments = await prisma.comment.findMany({
    where: { fileId, parentId: null, nodeId: { not: null } },
    select: { id: true, nodeId: true, frameId: true },
  });

  const allImageUrls = new Map<string, string>();
  const nodeIds = [...new Set(comments.map((c) => c.nodeId).filter((id): id is string => !!id))];
  if (nodeIds.length > 0) {
    const urls = await exportFrameImages(fileKey, nodeIds, token);
    for (const [nodeId, url] of urls) {
      if (url) allImageUrls.set(nodeId, url);
    }
  }

  const frameIdsToFetch = new Set<string>();
  for (const c of comments) {
    if (!c.frameId || !c.nodeId) continue;
    if (!allImageUrls.get(c.nodeId)) {
      frameIdsToFetch.add(c.frameId);
    }
  }
  if (frameIdsToFetch.size > 0) {
    const frameUrls = await exportFrameImages(fileKey, [...frameIdsToFetch], token);
    for (const [frameId, url] of frameUrls) {
      if (url) allImageUrls.set(frameId, url);
    }
  }

  if (!roundId) {
    return { cardsUpdated: 0, uniqueImages: allImageUrls.size };
  }

  const cards = await prisma.reviewCard.findMany({
    where: { roundId, comment: { fileId } },
    include: { comment: { select: { nodeId: true, frameId: true } } },
  });

  let cardsUpdated = 0;
  for (const card of cards) {
    const nodeId = card.comment.nodeId;
    const frameId = card.comment.frameId;
    let url: string | undefined;
    if (nodeId) url = allImageUrls.get(nodeId);
    if (!url && frameId) url = allImageUrls.get(frameId);
    if (!url) continue;
    await prisma.reviewCard.update({
      where: { id: card.id },
      data: { fullFrameUrl: url },
    });
    cardsUpdated++;
  }

  return { cardsUpdated, uniqueImages: allImageUrls.size };
}

async function ensurePostPrepareJobs(projectId: string, roundId: string) {
  const classifyPayload = {
    projectId,
    roundId,
    stage: "queued",
    stageLabel: "Queued",
  };
  const existing = await findQueuedJobByPayload(projectId, "classify", classifyPayload);
  if (existing) return;

  await createJobChain(projectId, [
    { type: "classify", payload: classifyPayload },
    { type: "cluster", payload: { projectId, roundId, stage: "queued", stageLabel: "Queued" } },
    { type: "export_images", payload: { projectId, roundId, fileOffset: 0, stage: "queued", stageLabel: "Queued" } },
  ]);
}

function errorCodeFor(err: unknown): string {
  if (err instanceof FigmaApiError) return `figma_http_${err.status}`;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return `prisma_${err.code}`;
  if (err instanceof Prisma.PrismaClientInitializationError) return "db_unreachable";
  return "job_failed";
}

export async function POST(req: NextRequest) {
  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected", code: "csrf_rejected" }, { status: 403 });
  }

  const job = await getNextPendingJob();
  if (!job) {
    const running = await prisma.job.findFirst({
      where: { status: "running" },
      select: { type: true, payload: true },
    });
    if (running) {
      const payload = asPayload(running.payload);
      return NextResponse.json({
        message: "jobs_running",
        runningType: running.type,
        progressLabel: progressLabel(payload),
        progressCurrent: asNumber(payload.progressCurrent, 0),
        progressTotal: asNumber(payload.progressTotal, 0),
      });
    }
    return NextResponse.json({ message: "all_done" });
  }

  const runStartedAt = Date.now();
  const claimed = await claimJob(job.id);
  if (!claimed) {
    const payload = asPayload(job.payload);
    return NextResponse.json({
      message: "jobs_running",
      runningType: job.type,
      progressLabel: progressLabel(payload),
      progressCurrent: asNumber(payload.progressCurrent, 0),
      progressTotal: asNumber(payload.progressTotal, 0),
    });
  }

  let payload = asPayload(claimed.payload);
  try {
    payload = await updateJobPayload(job.id, payload, {
      stage: "running",
      stageLabel: "Starting...",
    });

    switch (job.type as JobType | string) {
      case "sync_watch":
      case "sync_full": {
        const mode = job.type === "sync_full" ? "full" : "watch";
        payload = await updateJobPayload(job.id, payload, {
          stage: "syncing",
          stageLabel: "Syncing comments...",
        });
        const syncStartedAt = Date.now();
        const projectId = asString(payload.projectId);
        if (!projectId) throw new Error("Missing projectId");
        const syncResult = await syncProject(projectId, mode, asString(payload.roundId));
        if (syncResult.errors.length > 0) {
          logger.error("Sync errors", { projectId, errors: syncResult.errors });
        }
        payload = await updateJobPayload(job.id, payload, {
          stageLabel: `Synced ${syncResult.newComments} new comments`,
          syncMs: Date.now() - syncStartedAt,
        });
        break;
      }

      case "prepare_reanalysis": {
        const projectId = asString(payload.projectId);
        const roundId = asString(payload.roundId);
        if (!projectId || !roundId) {
          throw new Error("Missing projectId or roundId");
        }

        const chunkSize = asNumber(payload.chunkSize, 150);
        const cursor = asString(payload.cursor);
        const totalRoots =
          asNumber(payload.totalRoots, 0) ||
          (await prisma.comment.count({
            where: { file: { projectId }, parentId: null, resolvedAt: null },
          }));
        const processedRoots = asNumber(payload.processedRoots, 0);

        const roots = await prisma.comment.findMany({
          where: {
            file: { projectId },
            parentId: null,
            resolvedAt: null,
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          include: { file: { select: { fileKey: true } } },
          orderBy: { id: "asc" },
          take: chunkSize,
        });

        if (roots.length === 0) {
          await ensurePostPrepareJobs(projectId, roundId);
          payload = await updateJobPayload(job.id, payload, {
            stage: "prepared",
            stageLabel: `Prepared ${processedRoots}/${totalRoots} threads`,
            progressCurrent: processedRoots,
            progressTotal: totalRoots,
          });
          break;
        }

        const rootIds = roots.map((c) => c.id);
        const replies = await prisma.comment.findMany({
          where: { parentId: { in: rootIds } },
          select: { parentId: true, message: true, authorName: true, authorImg: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });
        const replyMap = new Map<
          string,
          { message: string; authorName: string; authorImg: string | null; createdAt: Date }[]
        >();
        for (const r of replies) {
          if (!r.parentId) continue;
          const list = replyMap.get(r.parentId) ?? [];
          list.push({
            message: r.message,
            authorName: r.authorName,
            authorImg: r.authorImg,
            createdAt: r.createdAt,
          });
          replyMap.set(r.parentId, list);
        }

        const existing = await prisma.reviewCard.findMany({
          where: { commentId: { in: rootIds } },
          select: { commentId: true },
        });
        const existingSet = new Set(existing.map((e) => e.commentId));

        let createdNow = 0;
        for (const root of roots) {
          const thread = replyMap.get(root.id) ?? [];
          const existed = existingSet.has(root.id);
          await prisma.reviewCard.upsert({
            where: { commentId: root.id },
            create: {
              commentId: root.id,
              roundId,
              commentThread: thread as unknown as Prisma.InputJsonValue,
              frameName: root.frameName ?? "Unknown",
              pageName: root.pageName ?? "Unknown",
              figmaDeepLink: buildFigmaDeepLink(root.file.fileKey, root.nodeId),
            },
            update: {
              roundId,
              commentThread: thread as unknown as Prisma.InputJsonValue,
              frameName: root.frameName ?? "Unknown",
              pageName: root.pageName ?? "Unknown",
              figmaDeepLink: buildFigmaDeepLink(root.file.fileKey, root.nodeId),
            },
          });
          if (!existed) createdNow++;
        }

        if (createdNow > 0) {
          await prisma.reviewRound.update({
            where: { id: roundId },
            data: { commentCount: { increment: createdNow } },
          });
        }

        const handledRoots = processedRoots + roots.length;
        const nextCursor = roots[roots.length - 1]?.id ?? "";
        payload = await updateJobPayload(job.id, payload, {
          stage: "preparing",
          stageLabel: `Preparing cards ${Math.min(handledRoots, totalRoots)}/${totalRoots}`,
          progressCurrent: Math.min(handledRoots, totalRoots),
          progressTotal: totalRoots,
          processedRoots: handledRoots,
        });

        if (roots.length === chunkSize && nextCursor) {
          const nextPayload = {
            ...payload,
            cursor: nextCursor,
            stage: "queued",
            stageLabel: `Preparing cards ${Math.min(handledRoots, totalRoots)}/${totalRoots}`,
          };
          const queued = await findQueuedJobByPayload(projectId, "prepare_reanalysis", nextPayload);
          if (!queued) {
            await createJob("prepare_reanalysis", projectId, nextPayload);
          }
        } else {
          await ensurePostPrepareJobs(projectId, roundId);
        }
        break;
      }

      case "export_images": {
        const projectId = asString(payload.projectId);
        if (!projectId) throw new Error("Missing projectId");
        const roundId = asString(payload.roundId);
        const offset = asNumber(payload.fileOffset, 0);

        const files = await prisma.figmaFile.findMany({
          where: { projectId },
          select: { id: true, fileKey: true },
          orderBy: { id: "asc" },
        });
        if (files.length === 0 || offset >= files.length) {
          payload = await updateJobPayload(job.id, payload, {
            stage: "export_done",
            stageLabel: "Image export done",
            progressCurrent: files.length,
            progressTotal: files.length,
          });
          break;
        }

        const file = files[offset];
        const exportStartedAt = Date.now();
        payload = await updateJobPayload(job.id, payload, {
          stage: "exporting_images",
          stageLabel: `Exporting images ${offset + 1}/${files.length}`,
          progressCurrent: offset + 1,
          progressTotal: files.length,
        });

        try {
          const exportResult = await processExportImagesForFile(projectId, file.id, file.fileKey, roundId);
          payload = await updateJobPayload(job.id, payload, {
            exportMs: Date.now() - exportStartedAt,
            cardsUpdated: exportResult.cardsUpdated,
            uniqueImages: exportResult.uniqueImages,
          });
        } catch (err) {
          logger.error("Export images failed (non-critical)", {
            projectId,
            fileId: file.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        if (offset + 1 < files.length) {
          const nextPayload = {
            ...payload,
            fileOffset: offset + 1,
            stage: "queued",
            stageLabel: `Queued image export ${offset + 2}/${files.length}`,
          };
          const queued = await findQueuedJobByPayload(projectId, "export_images", nextPayload);
          if (!queued) {
            await createJob("export_images", projectId, nextPayload);
          }
        }
        break;
      }

      case "classify": {
        const config = await prisma.teamConfig.findUnique({ where: { id: "default" } });
        if (config?.skipLlm) break;

        const projectId = asString(payload.projectId);
        if (!projectId) throw new Error("Missing projectId");
        const roundId = asString(payload.roundId);
        const cards = await prisma.reviewCard.findMany({
          where: {
            round: roundId ? { id: roundId, projectId } : { projectId },
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
        let done = 0;
        payload = await updateJobPayload(job.id, payload, {
          stage: "classifying",
          progressCurrent: done,
          progressTotal: cards.length,
          stageLabel: cards.length === 0 ? "No cards to classify" : `Classifying 0/${cards.length}`,
        });

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
          done += batch.length;
          payload = await updateJobPayload(job.id, payload, {
            progressCurrent: done,
            progressTotal: cards.length,
            stageLabel: `Classifying ${done}/${cards.length}`,
          });
          for (const r of results) {
            if (r.status === "rejected") {
              logger.error("Classification failed", { error: String(r.reason) });
            }
          }
        }
        break;
      }

      case "cluster": {
        const projectId = asString(payload.projectId);
        const roundId = asString(payload.roundId);
        if (!projectId || !roundId) break;

        payload = await updateJobPayload(job.id, payload, {
          stage: "clustering",
          stageLabel: "Clustering issues...",
        });

        const { clusterCards } = await import("@/lib/digest/cluster");
        await clusterCards(roundId);

        const config2 = await prisma.teamConfig.findUnique({ where: { id: "default" } });
        if (!config2?.skipLlm) {
          try {
            const roundData = await prisma.reviewRound.findUnique({
              where: { id: roundId },
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
                  where: { id: roundId },
                  data: { executiveSummary: JSON.stringify(summary) },
                });
              }
            }
          } catch (err) {
            logger.error("Executive summary failed", {
              roundId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        try {
          const integrationConfig =
            config2 ?? (await prisma.teamConfig.findUnique({ where: { id: "default" } }));
          const finalRound = await prisma.reviewRound.findUnique({
            where: { id: roundId },
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
            const digestUrl = `${baseUrl}/project/${projectId}/digest?roundId=${roundId}`;
            const criticalCount = finalRound.clusters.filter((c) =>
              c.cards.some((card) => card.assessment?.priorityHint === "critical")
            ).length;
            const topIssues = finalRound.clusters.slice(0, 5).map((c) => ({
              title: c.title,
              priority:
                c.cards.find((card) => card.assessment)?.assessment?.priorityHint ?? "medium",
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
                logger.error("Slack digest post failed", {
                  roundId,
                  error: slackResult.error,
                });
                await prisma.teamConfig
                  .update({
                    where: { id: "default" },
                    data: {
                      lastIntegrationError: `Slack: ${slackResult.error ?? "post failed"}`,
                      lastIntegrationErrorAt: new Date(),
                    },
                  })
                  .catch(() => {});
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
                } catch {
                  // ignore parse errors
                }
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
                logger.error("Confluence push failed", {
                  roundId,
                  error: confResult.error,
                });
                await prisma.teamConfig
                  .update({
                    where: { id: "default" },
                    data: {
                      lastIntegrationError: `Confluence: ${confResult.error ?? "push failed"}`,
                      lastIntegrationErrorAt: new Date(),
                    },
                  })
                  .catch(() => {});
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
          logger.error("Integration post-analysis failed", {
            roundId,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        break;
      }

      default:
        logger.warn("Unknown job type", { type: job.type });
    }

    await completeJob(job.id);
    logger.info("Job finished", {
      jobId: job.id,
      type: job.type,
      elapsedMs: Date.now() - runStartedAt,
    });

    const next = await getNextPendingJob();
    return NextResponse.json({
      jobId: job.id,
      type: job.type,
      status: "done",
      hasMore: !!next,
      nextType: next?.type ?? null,
      progressLabel: progressLabel(payload),
      progressCurrent: asNumber(payload.progressCurrent, 0),
      progressTotal: asNumber(payload.progressTotal, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    logger.error("Job failed", {
      jobId: job.id,
      type: job.type,
      error: message,
      code: errorCodeFor(err),
      elapsedMs: Date.now() - runStartedAt,
    });
    return NextResponse.json(
      {
        jobId: job.id,
        type: job.type,
        status: "failed",
        error: message,
        code: errorCodeFor(err),
      },
      { status: 500 }
    );
  }
}
