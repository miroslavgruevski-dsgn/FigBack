import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquare, BarChart3 } from "lucide-react";
import { verifyShareToken } from "@/lib/integrations/share-link";
import { prisma } from "@/lib/db";
import { StatsBar } from "@/components/digest/stats-bar";
import { IssueCard } from "@/components/digest/issue-card";
import type { Priority, IssueStatus } from "@/types/digest";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const secret = process.env.IMAGE_SIGN_SECRET;
  if (!secret) notFound();

  const payload = verifyShareToken(token, secret);
  if (!payload) notFound();

  const round = await prisma.reviewRound.findUnique({
    where: { id: payload.roundId },
    include: {
      project: { select: { name: true } },
      clusters: {
        include: {
          cards: {
            select: {
              id: true,
              figmaDeepLink: true,
              comment: {
                select: {
                  message: true,
                  authorName: true,
                  authorImg: true,
                  createdAt: true,
                  reactions: true,
                },
              },
              assessment: true,
            },
          },
        },
        orderBy: { lastSeenAt: "desc" },
      },
    },
  });

  if (!round) notFound();

  const totalComments = round.clusters.reduce((sum, c) => sum + c.cards.length, 0);
  const resolvedClusters = round.clusters.filter((c) => c.status === "done").length;
  const criticalCount = round.clusters.filter((c) =>
    c.cards.some((card) => card.assessment?.priorityHint === "critical")
  ).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-5 text-primary" />
        <h1 className="font-heading text-xl font-semibold">
          {round.project.name} - {round.name ?? "Digest"}
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Shared digest from FigBack · {new Date(round.syncedAt).toLocaleDateString()}
      </p>

      <div className="mt-6">
        <StatsBar
          totalComments={totalComments}
          totalClusters={round.clusters.length}
          resolvedClusters={resolvedClusters}
          criticalCount={criticalCount}
        />
      </div>

      <div className="mt-8 space-y-3">
        {round.clusters.length === 0 ? (
          <div className="glass rounded-lg p-8 text-center">
            <BarChart3 className="size-6 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No issues found in this digest.</p>
          </div>
        ) : null}
        {round.clusters.map((cluster) => {
          const topCard = cluster.cards
            .filter((c) => c.assessment)
            .sort((a, b) => {
              const ap = a.assessment?.priorityHint ?? "low";
              const bp = b.assessment?.priorityHint ?? "low";
              const order = ["critical", "high", "medium", "low"];
              return order.indexOf(ap) - order.indexOf(bp);
            })[0];
          const priority = topCard?.assessment?.priorityHint as Priority | undefined;
          return (
            <IssueCard
              key={cluster.id}
              title={cluster.title}
              summary={cluster.summary}
              frameName={cluster.frameName}
              pageName={cluster.pageName}
              status={cluster.status as IssueStatus}
              priority={priority}
              effortEstimate={cluster.effortEstimate}
              figmaDeepLink={cluster.cards.find((c) => c.figmaDeepLink)?.figmaDeepLink}
              suggestedAction={topCard?.assessment?.suggestedAction}
              comments={cluster.cards.map((card) => ({
                authorName: card.comment.authorName,
                authorImg: card.comment.authorImg,
                message: card.comment.message,
                createdAt: card.comment.createdAt.toISOString(),
                reactions: (card.comment.reactions ?? []) as { emoji: string; count: number; users: string[] }[],
              }))}
            />
          );
        })}
      </div>
    </div>
  );
}
