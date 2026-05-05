import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function recomputeRoundCommentCount(roundId: string): Promise<{
  computedCount: number;
  updated: boolean;
}> {
  const computedCount = await prisma.reviewCard.count({
    where: { roundId },
  });
  const round = await prisma.reviewRound.findUnique({
    where: { id: roundId },
    select: { commentCount: true },
  });
  if (!round) {
    return { computedCount, updated: false };
  }
  if (round.commentCount === computedCount) {
    return { computedCount, updated: false };
  }

  await prisma.reviewRound.update({
    where: { id: roundId },
    data: { commentCount: computedCount },
  });
  logger.warn("Repaired stale round comment count", {
    roundId,
    storedCount: round.commentCount,
    computedCount,
  });
  return { computedCount, updated: true };
}
