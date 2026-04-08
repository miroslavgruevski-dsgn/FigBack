import { prisma } from "@/lib/db";

interface RoundDiff {
  newComments: number;
  resolvedComments: number;
  newClusters: number;
  closedClusters: number;
}

export async function computeRoundDiff(
  projectId: string,
  currentRoundId: string
): Promise<RoundDiff | null> {
  const rounds = await prisma.reviewRound.findMany({
    where: { projectId },
    orderBy: { syncedAt: "desc" },
    take: 2,
    select: { id: true },
  });

  if (rounds.length < 2 || rounds[0].id !== currentRoundId) return null;

  const previousRoundId = rounds[1].id;

  const [currentCards, previousCards, currentClusters, previousClusters] =
    await Promise.all([
      prisma.reviewCard.count({ where: { roundId: currentRoundId } }),
      prisma.reviewCard.count({ where: { roundId: previousRoundId } }),
      prisma.issueCluster.count({ where: { roundId: currentRoundId } }),
      prisma.issueCluster.count({ where: { roundId: previousRoundId } }),
    ]);

  const resolvedCurrent = await prisma.issueCluster.count({
    where: { roundId: currentRoundId, status: "done" },
  });
  const resolvedPrevious = await prisma.issueCluster.count({
    where: { roundId: previousRoundId, status: "done" },
  });

  return {
    newComments: currentCards - previousCards,
    resolvedComments: resolvedCurrent - resolvedPrevious,
    newClusters: currentClusters - previousClusters,
    closedClusters: resolvedCurrent - resolvedPrevious,
  };
}
