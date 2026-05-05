"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, ChevronRight } from "lucide-react";
import { StatsBar } from "@/components/digest/stats-bar";
import { IssueCard } from "@/components/digest/issue-card";
import { Badge } from "@/components/ui/badge";
import { commentThreadToReplies } from "@/lib/digest/comment-thread";
import {
  displayFrameSection,
  frameGroupKey,
  pageGroupKey,
} from "@/lib/digest/display-labels";
import type { Priority, IssueStatus } from "@/types/digest";
import type { Prisma } from "@prisma/client";

type DigestFilter = "all" | "open" | "in_progress" | "done" | "dismissed" | "critical";

export interface DigestClusterView {
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
      createdAtIso: string;
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

export function DigestView({
  initialClusters,
  initialRoundCommentCount,
}: {
  initialClusters: DigestClusterView[];
  initialRoundCommentCount: number;
}) {
  const [clusters, setClusters] = useState(initialClusters);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeFilter = useMemo<DigestFilter>(() => {
    const status = searchParams.get("status");
    const critical = searchParams.get("critical");
    if (critical === "1") return "critical";
    if (status === "open" || status === "in_progress" || status === "done" || status === "dismissed") {
      return status;
    }
    return "all";
  }, [searchParams]);

  const totalComments = clusters.reduce((sum, c) => sum + c.cards.length, 0);
  const totalClusters = clusters.length;
  const openClusters = clusters.filter((c) => c.status === "open").length;
  const inProgressClusters = clusters.filter((c) => c.status === "in_progress").length;
  const resolvedClusters = clusters.filter((c) => c.status === "done").length;
  const dismissedClusters = clusters.filter((c) => c.status === "dismissed").length;
  const criticalCount = clusters.filter((c) =>
    c.cards.some((card) => card.assessment?.priorityHint === "critical")
  ).length;

  const visibleClusters = useMemo(() => {
    switch (activeFilter) {
      case "open":
      case "in_progress":
      case "done":
      case "dismissed":
        return clusters.filter((c) => c.status === activeFilter);
      case "critical":
        return clusters.filter((c) =>
          c.cards.some((card) => card.assessment?.priorityHint === "critical")
        );
      default:
        return clusters;
    }
  }, [clusters, activeFilter]);

  function setFilter(filter: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("critical");
    if (filter === "critical") {
      params.set("critical", "1");
    } else if (filter !== "all") {
      params.set("status", filter);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function onStatusChange(clusterId: string, status: IssueStatus) {
    setClusters((prev) =>
      prev.map((cluster) =>
        cluster.id === clusterId ? { ...cluster, status } : cluster
      )
    );
  }

  return (
    <>
      <div className="mt-6">
        <StatsBar
          totalComments={totalComments}
          totalClusters={totalClusters}
          resolvedClusters={resolvedClusters}
          criticalCount={criticalCount}
          openClusters={openClusters}
          inProgressClusters={inProgressClusters}
          dismissedClusters={dismissedClusters}
          activeFilter={activeFilter}
          onFilterChange={setFilter}
        />
      </div>

      <div className="mt-8">
        {visibleClusters.length === 0 ? (
          <div className="glass rounded-lg p-8 text-center max-w-lg mx-auto">
            <Filter className="size-6 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {activeFilter === "done"
                ? "No resolved issues in this analysis yet."
                : activeFilter === "in_progress"
                  ? "No issues are currently in progress."
                  : initialRoundCommentCount === 0
                    ? "No threads were added to this analysis. Usually every root comment is resolved in Figma, or threads were already used in a previous run."
                    : "No issues match this filter."}
            </p>
          </div>
        ) : (
          <SectionedClusters clusters={visibleClusters} onStatusChange={onStatusChange} />
        )}
      </div>
    </>
  );
}

function priorityOrder(p: string): number {
  switch (p) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 4;
  }
}

function SectionedClusters({
  clusters,
  onStatusChange,
}: {
  clusters: DigestClusterView[];
  onStatusChange: (clusterId: string, status: IssueStatus) => void;
}) {
  const pages = new Map<string, Map<string, DigestClusterView[]>>();

  for (const cluster of clusters) {
    const page = pageGroupKey(cluster.pageName);
    const frame = frameGroupKey(cluster.frameName);
    if (!pages.has(page)) pages.set(page, new Map());
    const frames = pages.get(page);
    if (!frames) continue;
    if (!frames.has(frame)) frames.set(frame, []);
    frames.get(frame)?.push(cluster);
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
        const pageHeading = pageName === "__page_unknown__" ? "Unnamed page" : pageName;
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
                      {displayFrameSection(frameName === "__frame_unknown__" ? "" : frameName)}
                    </p>
                  )}
                  <div className="space-y-3">
                    {items.map((cluster) => {
                      const topCard = cluster.cards
                        .filter((c) => c.assessment)
                        .sort(
                          (a, b) =>
                            priorityOrder(a.assessment?.priorityHint ?? "low") -
                            priorityOrder(b.assessment?.priorityHint ?? "low")
                        )[0];
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
                          onStatusChange={onStatusChange}
                          comments={cluster.cards.map((card) => ({
                            authorName: card.comment.authorName,
                            authorImg: card.comment.authorImg,
                            message: card.comment.message,
                            createdAt: card.comment.createdAtIso,
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
