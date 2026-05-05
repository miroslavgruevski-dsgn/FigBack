import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { createJobChain, expireStaleJobs, findActiveJobWithPayload } from "@/lib/jobs";

export const maxDuration = 60;

const digestSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: NextRequest) {
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

  const existing = await findActiveJobWithPayload(projectId, "sync_full");
  if (existing) {
    const roundId =
      typeof existing.payload.roundId === "string" ? existing.payload.roundId : undefined;
    return NextResponse.json({
      message: "Digest generation already in progress",
      jobId: existing.id,
      roundId,
    });
  }

  const round = await prisma.reviewRound.create({
    data: {
      projectId,
      name: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
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
