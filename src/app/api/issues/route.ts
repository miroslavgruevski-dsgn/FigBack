import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
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
