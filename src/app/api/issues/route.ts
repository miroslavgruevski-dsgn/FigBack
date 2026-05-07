import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-guards";
import { isCsrfOriginAllowed } from "@/lib/csrf";

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: z.enum(["open", "in_progress", "done", "dismissed"]).optional(),
  assignee: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  effortEstimate: z.enum(["small", "medium", "large"]).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const roundId = searchParams.get("roundId");
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  if (!roundId && !projectId) {
    return NextResponse.json({ error: "roundId or projectId required" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (roundId) where.roundId = roundId;
  if (projectId) {
    where.round = { projectId };
  }
  if (status) where.status = status;

  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  const clusters = await prisma.issueCluster.findMany({
    where,
    include: {
      cards: {
        include: {
          comment: {
            select: {
              id: true,
              message: true,
              authorName: true,
              authorImg: true,
              createdAt: true,
              resolvedAt: true,
            },
          },
          assessment: true,
        },
      },
    },
    orderBy: { lastSeenAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = clusters.length > limit;
  const items = hasMore ? clusters.slice(0, limit) : clusters;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return NextResponse.json({ items, nextCursor });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;
  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bulkUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { ids, ...updates } = parsed.data;
  const data: Record<string, unknown> = { ...updates };
  if (updates.status === "done") data.resolvedAt = new Date();
  if (updates.status === "open" || updates.status === "in_progress" || updates.status === "dismissed") {
    data.resolvedAt = null;
  }

  const selectedClusters = await prisma.issueCluster.findMany({
    where: { id: { in: ids } },
    select: {
      canonicalKey: true,
      round: { select: { projectId: true } },
    },
  });

  await prisma.issueCluster.updateMany({
    where: { id: { in: ids } },
    data,
  });

  const pairs = new Map<string, { projectId: string; canonicalKey: string }>();
  for (const cluster of selectedClusters) {
    if (!cluster.canonicalKey) continue;
    const key = `${cluster.round.projectId}::${cluster.canonicalKey}`;
    pairs.set(key, { projectId: cluster.round.projectId, canonicalKey: cluster.canonicalKey });
  }

  let propagated = 0;
  for (const pair of pairs.values()) {
    const result = await prisma.issueCluster.updateMany({
      where: {
        canonicalKey: pair.canonicalKey,
        round: { projectId: pair.projectId },
      },
      data,
    });
    propagated += result.count;
  }

  return NextResponse.json({ ok: true, updated: ids.length, propagated });
}
