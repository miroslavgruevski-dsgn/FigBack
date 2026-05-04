import Link from "next/link";
import { ArrowLeft, BarChart3, Filter, ChevronRight } from "lucide-react";
import { SummaryCard } from "@/components/digest/summary-card";
import { StatsBar } from "@/components/digest/stats-bar";
import { IssueCard } from "@/components/digest/issue-card";
import { DigestActions } from "./digest-actions";
import { DeleteAnalysisButton } from "../delete-analysis-button";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { commentThreadToReplies } from "@/lib/digest/comment-thread";
import {
  displayFrameSection,
  frameGroupKey,
  pageGroupKey,
} from "@/lib/digest/display-labels";
import type { Prisma } from "@prisma/client";
import type { Priority, IssueStatus } from "@/types/digest";

export const dynamic = "force-dynamic";

interface DigestRound {
  id: string;
  name: string;
  syncedAt: Date;
  executiveSummary: string;
  commentCount: number;
}

interface DigestCluster {
  id: string;
  title: string;
  summary: string;
  frameName: string;
  pageName: string;
  status: IssueStatus;
  effortEstimate: string | null;
  thumbnailUrl?: string;
  cards: {
    id: string;
    fullFrameUrl: string | null;
    figmaDeepLink: string | null;
    commentThread: Prisma.JsonValue | null;
    comment: {
      message: string;
      authorName: string;
      authorImg: string;
      createdAt: Date;
      resolvedAt: Date | null;
      reactions?: { emoji: string; count: number; users: string[] }[];
    };
    assessment: {
      issueType: string;
      priorityHint: Priority;
      elementTarget: string;
      actionability: string;
      suggestedAction: string;
      needsClarify: boolean;
      ambiguityReason: string | null;
    } | null;
  }[];
}

export default async function DigestPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ roundId?: string }>;
}) {
  const { projectId } = await params;
  const { roundId } = await searchParams;

  let round: DigestRound | null = null;
  let clusters: DigestCluster[] = [];
  let dbError = false;

  if (roundId) {
    try {
      const { prisma } = await import("@/lib/db");
      const dbRound = await prisma.reviewRound.findUnique({
        where: { id: roundId },
        include: {
          clusters: {
            include: {
              cards: {
                select: {
                  id: true,
                  fullFrameUrl: true,
                  figmaDeepLink: true,
                  commentThread: true,
                  comment: {
                    select: {
                      message: true,
                      authorName: true,
                      authorImg: true,
                      createdAt: true,
                      resolvedAt: true,
                      reactions: true,
                    },
                  },
                  assessment: true,
                },
                orderBy: { id: "asc" },
              },
            },
            orderBy: { lastSeenAt: "desc" },
          },
        },
      });
      if (dbRound) {
        round = {
          id: dbRound.id,
          name: dbRound.name ?? "Digest",
          syncedAt: dbRound.syncedAt,
          executiveSummary: dbRound.executiveSummary ?? "",
          commentCount: dbRound.commentCount,
        };
        clusters = dbRound.clusters.map((c) => {
          const cardsWithPreview = c.cards.filter((card) => card.fullFrameUrl);
          const preferred =
            cardsWithPreview.find((card) => card.assessment) ?? cardsWithPreview[0];
          return {
            id: c.id,
            title: c.title,
            summary: c.summary,
            frameName: c.frameName,
            pageName: c.pageName,
            status: c.status as IssueStatus,
            effortEstimate: c.effortEstimate,
            thumbnailUrl: preferred?.fullFrameUrl ?? undefined,
            cards: c.cards.map((card) => ({
              id: card.id,
              fullFrameUrl: card.fullFrameUrl,
              figmaDeepLink: card.figmaDeepLink,
              commentThread: card.commentThread,
              comment: {
                message: card.comment.message,
                authorName: card.comment.authorName,
                authorImg: card.comment.authorImg ?? "",
                createdAt: card.comment.createdAt,
                resolvedAt: card.comment.resolvedAt,
                reactions: (card.comment.reactions ?? []) as {
                  emoji: string;
                  count: number;
                  users: string[];
                }[],
              },
              assessment: card.assessment
                ? {
                    issueType: card.assessment.issueType,
                    priorityHint: card.assessment.priorityHint as Priority,
                    elementTarget: card.assessment.elementTarget,
                    actionability: card.assessment.actionability,
                    suggestedAction: card.assessment.suggestedAction,
                    needsClarify: card.assessment.needsClarify,
                    ambiguityReason: card.assessment.ambiguityReason,
                  }
                : null,
            })),
          };
        });
      }
    } catch {
      dbError = true;
    }
  }

  const backLink = (
    <Link
      href={`/project/${projectId}`}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to project
    </Link>
  );

  if (dbError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {backLink}
        <div className="mt-8">
          <ErrorState
            title="Failed to load digest"
            description="We couldn't connect to the database. Check your connection or try again later."
            backHref={`/project/${projectId}`}
            backLabel="Back to project"
          />
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {backLink}
        <h1 className="mt-6 font-heading text-2xl font-semibold">Digest</h1>
        <div className="glass mt-8 flex flex-col items-center rounded-lg px-6 py-12 text-center">
          <BarChart3 className="size-8 text-muted-foreground" />
          <h2 className="mt-4 font-heading text-lg font-semibold">No digest yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Generate a digest from the project page to see clustered feedback.
          </p>
        </div>
      </div>
    );
  }

  const totalComments = clusters.reduce((sum, c) => sum + c.cards.length, 0);
  const resolvedClusters = clusters.filter((c) => c.status === "done").length;
  const criticalCount = clusters.filter((c) =>
    c.cards.some((card) => card.assessment?.priorityHint === "critical")
  ).length;

  let summaryData: { summary: string; topIssues: string[]; sentiment: "positive" | "mixed" | "negative"; keyThemes: string[] } | null = null;
  if (round.executiveSummary) {
    try {
      summaryData = JSON.parse(round.executiveSummary);
    } catch {
      // invalid JSON
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/project/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to project
      </Link>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {round.name && round.name !== "Digest"
              ? round.name
              : new Date(round.syncedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {round.commentCount} comments analyzed · {totalComments} in digest ·{" "}
            {new Date(round.syncedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DeleteAnalysisButton
            projectId={projectId}
            roundId={round.id}
            analysisLabel={
              round.name !== "Digest"
                ? round.name
                : `Analysis · ${new Date(round.syncedAt).toLocaleDateString()}`
            }
            afterDelete="go-project"
            size="icon"
            variant="outline"
          />
          <DigestActions projectId={projectId} roundId={round.id} />
        </div>
      </div>

      <div className="mt-6">
        <StatsBar
          totalComments={totalComments}
          totalClusters={clusters.length}
          resolvedClusters={resolvedClusters}
          criticalCount={criticalCount}
        />
      </div>

      {summaryData && (
        <div className="mt-6">
          <SummaryCard
            summary={summaryData.summary}
            topIssues={summaryData.topIssues}
            sentiment={summaryData.sentiment}
            keyThemes={summaryData.keyThemes}
          />
        </div>
      )}

      <div className="mt-8">
        {clusters.length === 0 ? (
          <div className="glass rounded-lg p-8 text-center">
            <Filter className="size-6 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No issues found in this analysis.</p>
          </div>
        ) : (
          <SectionedClusters clusters={clusters} />
        )}
      </div>
    </div>
  );
}

function priorityOrder(p: string): number {
  switch (p) {
    case "critical": return 0;
    case "high": return 1;
    case "medium": return 2;
    case "low": return 3;
    default: return 4;
  }
}

function SectionedClusters({ clusters }: { clusters: DigestCluster[] }) {
  const pages = new Map<string, Map<string, DigestCluster[]>>();

  for (const cluster of clusters) {
    const page = pageGroupKey(cluster.pageName);
    const frame = frameGroupKey(cluster.frameName);
    if (!pages.has(page)) pages.set(page, new Map());
    const frames = pages.get(page)!;
    if (!frames.has(frame)) frames.set(frame, []);
    frames.get(frame)!.push(cluster);
  }

  for (const [, frames] of pages) {
    for (const [, items] of frames) {
      items.sort((a, b) => {
        const aPriority = a.cards.find((c) => c.assessment)?.assessment?.priorityHint ?? "low";
        const bPriority = b.cards.find((c) => c.assessment)?.assessment?.priorityHint ?? "low";
        return priorityOrder(aPriority) - priorityOrder(bPriority);
      });
    }
  }

  return (
    <div className="space-y-8">
      {Array.from(pages.entries()).map(([pageName, frames]) => {
        const pageIssueCount = Array.from(frames.values()).reduce((s, arr) => s + arr.length, 0);
        const pageHeading =
          pageName === "__page_unknown__" ? "Unnamed page" : pageName;
        return (
          <section key={pageName}>
            <div className="flex items-center gap-2 mb-4">
              <ChevronRight className="size-4 text-primary" />
              <h2 className="font-heading text-lg font-semibold">{pageHeading}</h2>
              <Badge variant="secondary" className="text-xs ml-1">
                {pageIssueCount} issue{pageIssueCount !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="space-y-6">
              {Array.from(frames.entries()).map(([frameName, items]) => (
                <div key={frameName}>
                  {frames.size > 1 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                      {displayFrameSection(
                        frameName === "__frame_unknown__" ? "" : frameName
                      )}
                    </p>
                  )}
                  <div className="space-y-3">
                    {items.map((cluster) => {
                      const topCard = cluster.cards
                        .filter((c) => c.assessment)
                        .sort((a, b) => priorityOrder(a.assessment!.priorityHint) - priorityOrder(b.assessment!.priorityHint))[0];

                      const topPriority = topCard?.assessment?.priorityHint as Priority | undefined;

                      return (
                        <IssueCard
                          key={cluster.id}
                          clusterId={cluster.id}
                          title={cluster.title}
                          summary={cluster.summary}
                          frameName={cluster.frameName}
                          pageName={cluster.pageName}
                          status={cluster.status}
                          priority={topPriority}
                          effortEstimate={cluster.effortEstimate}
                          figmaDeepLink={cluster.cards.find((c) => c.figmaDeepLink)?.figmaDeepLink}
                          suggestedAction={topCard?.assessment?.suggestedAction}
                          thumbnailUrl={cluster.thumbnailUrl}
                          comments={cluster.cards.map((card) => ({
                            authorName: card.comment.authorName,
                            authorImg: card.comment.authorImg,
                            message: card.comment.message,
                            createdAt: card.comment.createdAt.toISOString(),
                            reactions: card.comment.reactions,
                            replies: commentThreadToReplies(card.commentThread),
                          }))}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
