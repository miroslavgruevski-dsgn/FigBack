import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const updateSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "dismissed"]).optional(),
  assignee: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  effortEstimate: z.enum(["small", "medium", "large"]).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.issueCluster.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "done") {
    data.resolvedAt = new Date();
  }
  if (parsed.data.status === "open" || parsed.data.status === "in_progress") {
    data.resolvedAt = null;
  }
  if (parsed.data.status === "dismissed") {
    data.resolvedAt = null;
  }

  const cluster = await prisma.issueCluster.update({
    where: { id },
    data,
  });
  if (parsed.data.status) {
    logger.info("Issue status changed", {
      clusterId: id,
      from: existing.status,
      to: parsed.data.status,
    });
  }

  return NextResponse.json(cluster);
}
