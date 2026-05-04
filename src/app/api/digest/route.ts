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
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = digestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { projectId } = parsed.data;

  await expireStaleJobs(projectId);

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
