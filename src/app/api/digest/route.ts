import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createJobChain, hasActiveJob, expireStaleJobs } from "@/lib/jobs";

const digestSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = digestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { projectId } = parsed.data;

  await expireStaleJobs(projectId);

  const existing = await hasActiveJob(projectId, "sync_full");
  if (existing) {
    return NextResponse.json({
      message: "Digest generation already in progress",
      jobId: existing.id,
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
    { type: "export_images", payload: { projectId, roundId: round.id } },
    { type: "classify", payload: { projectId, roundId: round.id } },
    { type: "cluster", payload: { projectId, roundId: round.id } },
  ]);

  return NextResponse.json({ jobId: firstJob?.id, roundId: round.id });
}
