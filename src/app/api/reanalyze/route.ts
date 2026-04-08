import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createJobChain, hasActiveJob } from "@/lib/jobs";
import { buildFigmaDeepLink } from "@/lib/figma/sync";
import type { Prisma } from "@prisma/client";

const schema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { projectId } = parsed.data;

  const active = await hasActiveJob(projectId, "classify");
  if (active) {
    return NextResponse.json({ message: "Re-analysis already in progress", jobId: active.id });
  }

  // Reset processed flag so comments can be re-carded
  await prisma.comment.updateMany({
    where: { file: { projectId }, processed: true },
    data: { processed: false },
  });

  const round = await prisma.reviewRound.create({
    data: {
      projectId,
      name: `Re-analysis ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    },
  });

  // Create ReviewCards from existing comments
  const rootComments = await prisma.comment.findMany({
    where: { file: { projectId }, parentId: null, processed: false },
    include: { file: { select: { fileKey: true } } },
  });

  const replyMap = new Map<string, { message: string; authorName: string; authorImg: string | null; createdAt: Date }[]>();
  if (rootComments.length > 0) {
    const replies = await prisma.comment.findMany({
      where: { parentId: { in: rootComments.map((c) => c.id) } },
      select: { parentId: true, message: true, authorName: true, authorImg: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    for (const r of replies) {
      if (!r.parentId) continue;
      const list = replyMap.get(r.parentId) ?? [];
      list.push({ message: r.message, authorName: r.authorName, authorImg: r.authorImg, createdAt: r.createdAt });
      replyMap.set(r.parentId, list);
    }
  }

  let created = 0;
  for (const comment of rootComments) {
    const thread = replyMap.get(comment.id) ?? [];
    await prisma.reviewCard.create({
      data: {
        commentId: comment.id,
        roundId: round.id,
        commentThread: thread as unknown as Prisma.InputJsonValue,
        frameName: comment.frameName ?? "Unknown",
        pageName: comment.pageName ?? "Unknown",
        figmaDeepLink: buildFigmaDeepLink(comment.file.fileKey, comment.nodeId),
      },
    });
    await prisma.comment.update({
      where: { id: comment.id },
      data: { processed: true },
    });
    created++;
  }

  await prisma.reviewRound.update({
    where: { id: round.id },
    data: { commentCount: created },
  });

  // Chain classify → cluster
  await createJobChain(projectId, [
    { type: "classify", payload: { projectId, roundId: round.id } },
    { type: "cluster", payload: { projectId, roundId: round.id } },
  ]);

  return NextResponse.json({ roundId: round.id, cardsCreated: created });
}
