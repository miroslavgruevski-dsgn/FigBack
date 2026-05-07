import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-guards";
import { createJobChain, expireStaleJobs, findActivePipelineJob } from "@/lib/jobs";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiErrorJson } from "@/lib/errors";
import { prisma } from "@/lib/db";

const syncSchema = z.object({
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

  const { allowed } = checkRateLimit(`sync:${userId}`);
  if (!allowed) {
    return apiErrorJson(429, "rate_limited", "Too many requests. Try again in a minute.");
  }

  const body = await req.json();
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { projectId } = parsed.data;

  await expireStaleJobs(projectId);

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
