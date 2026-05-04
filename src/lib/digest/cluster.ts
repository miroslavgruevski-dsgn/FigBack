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

export async function clusterCards(roundId: string) {
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
    const key = buildClusterKey(card);
    const group = groups.get(key) ?? [];
    group.push(card);
    groups.set(key, group);
  }

  const operations = [];
  for (const [, group] of groups) {
    if (group.length === 0) continue;

    const representative = group[0];
    const issueType = representative.assessment?.issueType ?? "other";

    operations.push(
      prisma.issueCluster.create({
        data: {
          roundId,
          title: buildClusterTitle(representative, group.length),
          summary: buildClusterSummary(group),
          frameId:
            representative.comment.frameId ??
            representative.comment.nodeId ??
            "unknown",
          frameName: representative.frameName,
          pageId: representative.comment.pageId ?? "unknown",
          pageName: representative.pageName,
          status: "open",
          effortEstimate: estimateEffort(group.length, issueType),
          cards: {
            connect: group.map((c) => ({ id: c.id })),
          },
        },
      })
    );
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }
}

function buildClusterKey(card: CardForClustering): string {
  const place =
    card.comment.frameId ??
    card.comment.nodeId ??
    card.id;
  const issueType = card.assessment?.issueType ?? "other";
  const target = card.assessment?.elementTarget?.toLowerCase().trim() ?? "";

  return `${place}::${issueType}::${target}`;
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
