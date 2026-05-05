import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { createJob, expireStaleJobs, findActiveJobWithPayload } from "@/lib/jobs";
import { logger } from "@/lib/logger";

const schema = z.object({
  projectId: z.string().min(1),
});

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!isCsrfOriginAllowed(req)) {
      return NextResponse.json(
        { error: "CSRF rejected", code: "csrf_rejected" },
        { status: 403 }
      );
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

    const activePrepare = await findActiveJobWithPayload(projectId, "prepare_reanalysis");
    if (activePrepare) {
      const roundId =
        typeof activePrepare.payload.roundId === "string"
          ? activePrepare.payload.roundId
          : undefined;
      return NextResponse.json({
        message: "Re-analysis already in progress",
        code: "already_in_progress",
        jobId: activePrepare.id,
        roundId,
        jobsQueued: true,
      });
    }

    const activeClassify = await findActiveJobWithPayload(projectId, "classify");
    if (activeClassify) {
      const roundId =
        typeof activeClassify.payload.roundId === "string"
          ? activeClassify.payload.roundId
          : undefined;
      return NextResponse.json({
        message: "Re-analysis already in progress",
        code: "already_in_progress",
        jobId: activeClassify.id,
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

    const round = await prisma.reviewRound.create({
      data: {
        projectId,
        name: `Re-analysis ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
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
