import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-guards";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { createJobChain, expireStaleJobs, findActivePipelineJob } from "@/lib/jobs";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiErrorJson } from "@/lib/errors";

export const maxDuration = 60;

const digestSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;
  const userId = guard.session.user?.id;
  if (!userId) {
    return apiErrorJson(401, "unauthorized", "Unauthorized");
  }

  if (!isCsrfOriginAllowed(req)) {
    return apiErrorJson(403, "csrf_rejected", "CSRF rejected");
  }

  const { allowed } = checkRateLimit(`digest:${userId}`);
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

  const parsed = digestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", code: "validation_failed" },
      { status: 400 }
    );
  }

  const { projectId } = parsed.data;

  await expireStaleJobs(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      files: { include: { _count: { select: { comments: true } } } },
    },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "project_not_found" },
      { status: 404 }
    );
  }
  if (project.files.length === 0) {
    return NextResponse.json(
      { error: "Link a Figma file first.", code: "no_files" },
      { status: 400 }
    );
  }
  const hasAnySync = project.files.some((f) => !!f.lastSyncedAt);
  if (!hasAnySync) {
    return NextResponse.json(
      { error: "Run Sync project before analyzing.", code: "sync_required" },
      { status: 400 }
    );
  }
  const scopedFiles = project.files.filter(
    (f) =>
      (f.includedPages?.length ?? 0) > 0 || (f.includedFrames?.length ?? 0) > 0
  );
  if (
    scopedFiles.length > 0 &&
    scopedFiles.reduce((sum, f) => sum + f._count.comments, 0) === 0
  ) {
    return NextResponse.json(
      {
        error:
          "No comments are currently in selected scope. Sync again or adjust Scope.",
        code: "no_scope_comments",
      },
      { status: 400 }
    );
  }

  const existing = await findActivePipelineJob(projectId);
  if (existing) {
    const roundId =
      typeof existing.payload.roundId === "string" ? existing.payload.roundId : undefined;
    return NextResponse.json({
      message: "Analysis already running",
      jobId: existing.id,
      roundId,
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
      name: roundName,
    },
  });

  const firstJob = await createJobChain(projectId, [
    { type: "sync_full", payload: { projectId, roundId: round.id } },
    { type: "classify", payload: { projectId, roundId: round.id } },
    { type: "cluster", payload: { projectId, roundId: round.id } },
    { type: "export_images", payload: { projectId, roundId: round.id } },
  ]);

  return NextResponse.json({ jobId: firstJob?.id, roundId: round.id });
}
