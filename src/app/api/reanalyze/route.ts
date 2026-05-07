import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireApiSession } from "@/lib/api-guards";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { createJob, expireStaleJobs, findActivePipelineJob } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiErrorJson } from "@/lib/errors";

const schema = z.object({
  projectId: z.string().min(1),
});

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession();
    if (!guard.ok) return guard.response;
    const userId = guard.session.user?.id;
    if (!userId) {
      return apiErrorJson(401, "unauthorized", "Unauthorized");
    }

    if (!isCsrfOriginAllowed(req)) {
      return apiErrorJson(403, "csrf_rejected", "CSRF rejected");
    }

    const { allowed } = checkRateLimit(`reanalyze:${userId}`);
    if (!allowed) {
      return apiErrorJson(429, "rate_limited", "Too many requests. Try again in a minute.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON", code: "invalid_json" },
        { status: 400 }
      );
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "validation_failed" },
        { status: 400 }
      );
    }

    const { projectId } = parsed.data;
    await expireStaleJobs(projectId);

    const activePipeline = await findActivePipelineJob(projectId);
    if (activePipeline) {
      const roundId =
        typeof activePipeline.payload.roundId === "string"
          ? activePipeline.payload.roundId
          : undefined;
      return NextResponse.json({
        message: "Analysis already running",
        code: "already_in_progress",
        jobId: activePipeline.id,
        roundId,
        jobsQueued: true,
      });
    }

    const rootCommentCount = await prisma.comment.count({
      where: { file: { projectId }, parentId: null, resolvedAt: null },
    });
    if (rootCommentCount === 0) {
      return NextResponse.json({
        message: "no_comments",
        code: "no_comments",
        cardsCreated: 0,
      });
    }

    const now = new Date();
    const roundName = now.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const round = await prisma.reviewRound.create({
      data: {
        projectId,
        name: `Re-analysis · ${roundName}`,
      },
    });

    const preparePayload = {
      projectId,
      roundId: round.id,
      cursor: "",
      chunkSize: 150,
      totalRoots: rootCommentCount,
      processedRoots: 0,
      stage: "queued",
      stageLabel: "Queued",
    };

    const firstJob = await createJob("prepare_reanalysis", projectId, preparePayload);
    logger.info("Re-analysis queued", {
      projectId,
      roundId: round.id,
      rootCommentCount,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      roundId: round.id,
      jobsQueued: true,
      jobId: firstJob.id,
      message: "queued",
      code: "reanalyze_queued",
    });
  } catch (err) {
    logger.error("Re-analyze start failed", {
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - startedAt,
    });
    if (err instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        {
          error: "Cannot connect to the database.",
          code: "db_unreachable",
        },
        { status: 503 }
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          error: "Could not start re-analysis. Try again.",
          code: `prisma_${err.code}`,
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Could not start re-analysis.", code: "server_error" },
      { status: 500 }
    );
  }
}
