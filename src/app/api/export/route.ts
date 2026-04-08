import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toMarkdown, toCsv } from "@/lib/integrations/export";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const roundId = searchParams.get("roundId");
  const format = searchParams.get("format") ?? "markdown";

  if (!roundId) {
    return NextResponse.json({ error: "roundId required" }, { status: 400 });
  }

  const round = await prisma.reviewRound.findUnique({
    where: { id: roundId },
    include: {
      project: { select: { name: true } },
      clusters: {
        include: {
          cards: {
            include: {
              comment: {
                select: { authorName: true, message: true, createdAt: true },
              },
              assessment: { select: { priorityHint: true } },
            },
          },
        },
      },
    },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const clusters = round.clusters.map((c) => ({
    title: c.title,
    summary: c.summary,
    frameName: c.frameName,
    priority: c.cards[0]?.assessment?.priorityHint ?? "medium",
    status: c.status,
    effortEstimate: c.effortEstimate,
    comments: c.cards.map((card) => ({
      authorName: card.comment.authorName,
      message: card.comment.message,
      createdAt: card.comment.createdAt.toISOString(),
    })),
  }));

  if (format === "csv") {
    const csv = toCsv(clusters);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="figback-${roundId}.csv"`,
      },
    });
  }

  const md = toMarkdown(
    round.project.name,
    round.name ?? "Digest",
    round.executiveSummary,
    clusters
  );

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename="figback-${roundId}.md"`,
    },
  });
}
