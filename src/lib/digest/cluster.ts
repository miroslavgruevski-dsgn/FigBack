import { prisma } from "@/lib/db";

interface CardForClustering {
  id: string;
  frameName: string;
  pageName: string;
  comment: {
    frameId: string | null;
    nodeId: string | null;
    pageId: string | null;
  };
  assessment: {
    issueType: string;
    elementTarget: string;
    priorityHint: string;
    suggestedAction: string;
  } | null;
}

type PreviousClusterState = {
  status: string;
  effortEstimate: string | null;
  assignee: string | null;
  notes: string | null;
  resolvedAt: Date | null;
};

type RankableCluster = {
  firstSeenAt?: Date | null;
  cards: { assessment?: { priorityHint?: string | null } | null }[];
};

export async function clusterCards(roundId: string) {
  const round = await prisma.reviewRound.findUnique({
    where: { id: roundId },
    select: { projectId: true },
  });
  if (!round) return;

  const cards = await prisma.reviewCard.findMany({
    where: { roundId },
    include: {
      comment: { select: { frameId: true, nodeId: true, pageId: true } },
      assessment: {
        select: { issueType: true, elementTarget: true, priorityHint: true, suggestedAction: true },
      },
    },
  });

  const groups = new Map<string, CardForClustering[]>();

  for (const card of cards) {
    const key = buildClusterCanonicalKey(card);
    const group = groups.get(key) ?? [];
    group.push(card);
    groups.set(key, group);
  }

  const previousClusters = await prisma.issueCluster.findMany({
    where: {
      round: { projectId: round.projectId },
      canonicalKey: { not: null },
    },
    select: {
      canonicalKey: true,
      status: true,
      effortEstimate: true,
      assignee: true,
      notes: true,
      resolvedAt: true,
      lastSeenAt: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });
  const previousStateByKey = new Map<string, PreviousClusterState>();
  for (const cluster of previousClusters) {
    if (!cluster.canonicalKey) continue;
    if (!previousStateByKey.has(cluster.canonicalKey)) {
      previousStateByKey.set(cluster.canonicalKey, {
        status: cluster.status,
        effortEstimate: cluster.effortEstimate,
        assignee: cluster.assignee,
        notes: cluster.notes,
        resolvedAt: cluster.resolvedAt,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.issueCluster.deleteMany({ where: { roundId } });

    for (const [canonicalKey, group] of groups) {
      if (group.length === 0) continue;

      const representative = group[0];
      const issueType = representative.assessment?.issueType ?? "other";
      const previousState = previousStateByKey.get(canonicalKey);

      await tx.issueCluster.create({
        data: {
          roundId,
          canonicalKey,
          title: buildClusterTitle(representative, group.length),
          summary: buildClusterSummary(group),
          frameId:
            representative.comment.frameId ??
            representative.comment.nodeId ??
            "unknown",
          frameName: representative.frameName,
          pageId: representative.comment.pageId ?? "unknown",
          pageName: representative.pageName,
          status: previousState?.status ?? "open",
          effortEstimate: previousState?.effortEstimate ?? estimateEffort(group.length, issueType),
          assignee: previousState?.assignee ?? null,
          notes: previousState?.notes ?? null,
          resolvedAt: previousState?.status === "done" ? previousState.resolvedAt ?? new Date() : null,
          cards: {
            connect: group.map((c) => ({ id: c.id })),
          },
        },
      });
    }
  });
}

export function computeClusterPriorityScore(
  priorityHints: string[],
  frequency: number,
  oldestSeenAt?: Date | null,
  recurrence = 0
): number {
  const severityMap: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const severitySignal = priorityHints.reduce((sum, p) => sum + (severityMap[p] ?? 1), 0);
  const ageDays = oldestSeenAt
    ? Math.max(0, (Date.now() - oldestSeenAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const ageSignal = Math.min(10, ageDays) * 1.5;
  const frequencySignal = Math.max(1, frequency) * 3;
  const recurrenceSignal = Math.max(0, recurrence) * 2;
  return severitySignal * 8 + frequencySignal + ageSignal + recurrenceSignal;
}

export function rankIssueClusters<T extends RankableCluster>(clusters: T[]): T[] {
  return [...clusters].sort((a, b) => {
    const aHints = a.cards
      .map((card) => card.assessment?.priorityHint ?? "low")
      .filter((hint): hint is string => typeof hint === "string");
    const bHints = b.cards
      .map((card) => card.assessment?.priorityHint ?? "low")
      .filter((hint): hint is string => typeof hint === "string");
    const aScore = computeClusterPriorityScore(aHints, a.cards.length, a.firstSeenAt ?? null);
    const bScore = computeClusterPriorityScore(bHints, b.cards.length, b.firstSeenAt ?? null);
    return bScore - aScore;
  });
}

export function buildClusterCanonicalKey(card: CardForClustering): string {
  const place =
    card.comment.frameId ??
    card.comment.nodeId ??
    card.id;
  const issueType = card.assessment?.issueType ?? "other";
  const target = normalizeSegment(card.assessment?.elementTarget ?? "");

  return `${normalizeSegment(place)}::${normalizeSegment(issueType)}::${target}`;
}

function buildClusterTitle(card: CardForClustering, count: number): string {
  const type = card.assessment?.issueType ?? "issue";
  const target = card.assessment?.elementTarget ?? card.frameName;
  const suffix = count > 1 ? ` (${count} comments)` : "";
  return `${capitalize(type)}: ${target}${suffix}`;
}

function buildClusterSummary(group: CardForClustering[]): string {
  if (group.length === 1 && group[0].assessment) {
    return group[0].assessment.suggestedAction;
  }

  const actions = group
    .filter((c) => c.assessment?.suggestedAction)
    .map((c) => c.assessment!.suggestedAction);

  return actions.slice(0, 3).join(". ") + (actions.length > 3 ? "..." : "");
}

function estimateEffort(count: number, issueType: string): string {
  if (issueType === "bug" || issueType === "accessibility") {
    return count > 3 ? "large" : count > 1 ? "medium" : "small";
  }
  return count > 5 ? "large" : count > 2 ? "medium" : "small";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
