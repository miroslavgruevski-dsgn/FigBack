import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Soft-archives projects whose last activity is older than `archiveDays` (from TeamConfig).
 * Activity = max(project.updatedAt, latest round syncedAt, latest file lastSyncedAt).
 * Does not delete rows.
 */
export async function archiveIdleProjects(): Promise<{
  archiveDays: number;
  cutoff: string;
  archivedCount: number;
  examinedCount: number;
}> {
  const config = await prisma.teamConfig.findUnique({ where: { id: "default" } });
  const archiveDays = config?.archiveDays ?? 90;
  const cutoffMs = Date.now() - archiveDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffMs);

  const candidates = await prisma.project.findMany({
    where: { archived: false },
    select: {
      id: true,
      updatedAt: true,
      files: { select: { lastSyncedAt: true } },
    },
  });

  const ids = candidates.map((p) => p.id);
  let roundMaxByProject = new Map<string, Date>();

  if (ids.length > 0) {
    const grouped = await prisma.reviewRound.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids } },
      _max: { syncedAt: true },
    });
    roundMaxByProject = new Map(
      grouped.map((g) => [g.projectId, g._max.syncedAt ?? new Date(0)])
    );
  }

  const toArchive: string[] = [];

  for (const p of candidates) {
    let lastMs = p.updatedAt.getTime();
    const roundSync = roundMaxByProject.get(p.id);
    if (roundSync) lastMs = Math.max(lastMs, roundSync.getTime());
    for (const f of p.files) {
      if (f.lastSyncedAt) lastMs = Math.max(lastMs, f.lastSyncedAt.getTime());
    }

    if (lastMs < cutoffMs) {
      toArchive.push(p.id);
    }
  }

  if (toArchive.length > 0) {
    await prisma.project.updateMany({
      where: { id: { in: toArchive } },
      data: { archived: true },
    });
    logger.info("Archived idle projects", {
      count: toArchive.length,
      archiveDays,
      cutoff: cutoff.toISOString(),
    });
  }

  return {
    archiveDays,
    cutoff: cutoff.toISOString(),
    archivedCount: toArchive.length,
    examinedCount: candidates.length,
  };
}
