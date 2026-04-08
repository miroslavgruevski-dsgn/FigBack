import { prisma } from "@/lib/db";

export async function detectResolvedComments(roundId: string) {
  const round = await prisma.reviewRound.findUniqueOrThrow({
    where: { id: roundId },
    include: {
      cards: {
        include: {
          comment: { select: { id: true, resolvedAt: true } },
        },
      },
    },
  });

  const resolvedCardIds = round.cards
    .filter((c) => c.comment.resolvedAt !== null)
    .map((c) => c.id);

  if (resolvedCardIds.length === 0) return { resolved: 0 };

  const clusters = await prisma.issueCluster.findMany({
    where: {
      roundId,
      cards: { some: { id: { in: resolvedCardIds } } },
    },
    include: {
      cards: { select: { id: true, comment: { select: { resolvedAt: true } } } },
    },
  });

  let autoResolved = 0;

  for (const cluster of clusters) {
    const allResolved = cluster.cards.every((c) => c.comment.resolvedAt !== null);
    if (allResolved && cluster.status === "open") {
      await prisma.issueCluster.update({
        where: { id: cluster.id },
        data: { status: "done", resolvedAt: new Date() },
      });
      autoResolved++;
    }
  }

  return { resolved: autoResolved };
}
