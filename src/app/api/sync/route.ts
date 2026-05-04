import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createJobChain, hasActiveJob } from "@/lib/jobs";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";

const syncSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const { allowed } = checkRateLimit("sync");
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { projectId } = parsed.data;

  const existing = await hasActiveJob(projectId, "sync_full");
  if (existing) {
    return NextResponse.json({
      message: "Sync already in progress",
      jobId: existing.id,
    });
  }

  const firstJob = await createJobChain(projectId, [
    { type: "sync_full", payload: { projectId } },
    { type: "export_images", payload: { projectId } },
    { type: "classify", payload: { projectId } },
    { type: "cluster", payload: { projectId } },
  ]);

  return NextResponse.json({ jobId: firstJob?.id });
}
