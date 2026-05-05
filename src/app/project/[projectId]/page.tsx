import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Sparkles, MessageSquare, TrendingUp } from "lucide-react";
import { GenerateDigestButton } from "./generate-button";
import { ReanalyzeButton } from "./reanalyze-button";
import { DeleteProjectButton } from "./delete-project-button";
import { ArchiveProjectButton } from "./archive-project-button";
import { EditableTitle } from "./editable-title";
import { FigmaTokenField } from "./figma-token-field";
import { FileManager } from "./file-manager";
import { DeleteAnalysisButton } from "./delete-analysis-button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { ProjectAlerts, type ProjectAlertItem } from "@/components/project/project-alerts";

export const dynamic = "force-dynamic";

type RoundWithFiles = {
  id: string;
  name: string | null;
  syncedAt: Date;
  commentCount: number;
  files?: { name: string; commentCount: number }[];
};

interface ProjectData {
  id: string;
  name: string;
  archived: boolean;
  figmaAccessToken?: string | null;
  files: {
    id: string;
    name: string;
    fileKey: string;
    url: string;
    lastSyncedAt: Date | null;
    lastError: string | null;
    includedPages?: string[];
    includedFrames?: string[];
    lastSyncFigmaCommentTotal: number | null;
    lastSyncImportedCount: number | null;
    lastSyncSkippedScopeCount: number | null;
    _count: { comments: number };
  }[];
  rounds: RoundWithFiles[];
  _count: { rounds: number };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  let project: ProjectData | null = null;
  let dbError = false;
  let newCommentCount = 0;
  let projectAlerts: ProjectAlertItem[] = [];
  let unresolvedRootCount = 0;

  try {
    const { prisma } = await import("@/lib/db");
    const raw = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        files: { include: { _count: { select: { comments: true } } } },
        rounds: {
          orderBy: { syncedAt: "desc" },
          take: 10,
          select: {
            id: true, name: true, syncedAt: true, commentCount: true,
            cards: { select: { comment: { select: { file: { select: { name: true } } } } } },
          },
        },
        _count: { select: { rounds: true } },
      },
    });
    if (raw) {
      const rounds = raw.rounds.map((r) => {
        const fileCounts = new Map<string, number>();
        for (const card of r.cards) {
          const name = card.comment.file.name;
          fileCounts.set(name, (fileCounts.get(name) ?? 0) + 1);
        }
        return {
          id: r.id, name: r.name, syncedAt: r.syncedAt, commentCount: r.commentCount,
          files: [...fileCounts.entries()].map(([name, count]) => ({ name, commentCount: count })),
        };
      });
      project = { ...raw, rounds } as unknown as ProjectData;

      if (raw.rounds.length > 0) {
        const lastRoundDate = raw.rounds[0].syncedAt;
        newCommentCount = await prisma.comment.count({
          where: {
            file: { projectId },
            parentId: null,
            createdAt: { gt: lastRoundDate },
          },
        });
      }

      const [failedJobRow, teamCfg, ur] = await Promise.all([
        prisma.job.findFirst({
          where: { projectId, status: "failed" },
          orderBy: { doneAt: "desc" },
          select: { error: true, type: true },
        }),
        prisma.teamConfig.findUnique({
          where: { id: "default" },
          select: {
            skipLlm: true,
            llmApiKey: true,
            lastIntegrationError: true,
            lastIntegrationErrorAt: true,
            cronEnabled: true,
          },
        }),
        prisma.comment.count({
          where: { file: { projectId }, parentId: null, resolvedAt: null },
        }),
      ]);
      unresolvedRootCount = ur;

      const failedJob =
        failedJobRow?.error === "Expired (stale)" ? null : failedJobRow;

      const alertList: ProjectAlertItem[] = [];
      if (failedJob?.error) {
        alertList.push({
          key: "job-failed",
          title: "A background job failed",
          detail: failedJob.error.slice(0, 400),
        });
      }
      if (teamCfg?.lastIntegrationError) {
        alertList.push({
          key: "integration",
          title: "Integration issue (Slack or Confluence)",
          detail: teamCfg.lastIntegrationError,
          href: "/settings",
          linkText: "Review in settings",
        });
      }
      if (teamCfg && !teamCfg.skipLlm && !teamCfg.llmApiKey) {
        alertList.push({
          key: "llm-key",
          title: "LLM API key not saved",
          detail:
            "Add a key under Settings, set a provider env var on the server, or turn on Skip LLM for grouping without classification.",
          href: "/settings",
          linkText: "Open settings",
        });
      }
      if (teamCfg && teamCfg.cronEnabled === false) {
        alertList.push({
          key: "cron-off",
          title: "Daily auto-check for new comments is off",
          detail: "Enable it in Settings if you want scheduled watch-mode syncs.",
          href: "/settings",
          linkText: "Settings",
        });
      }
      projectAlerts = alertList;
    }
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          All projects
        </Link>
        <div className="mt-8 space-y-6">
          <ErrorState
            title="Failed to load project"
            description="We couldn't connect to the database. Check your DATABASE_URL or try again later."
          />
          <div className="flex justify-center">
            <DeleteProjectButton projectId={projectId} afterDelete="home" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) notFound();

  const totalComments = project.files.reduce((sum, f) => sum + f._count.comments, 0);
  const hasTokenError = project.files.some(
    (f) =>
      f.lastError &&
      (/token/i.test(f.lastError) ||
        /403|401/.test(f.lastError) ||
        /rejected/i.test(f.lastError))
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All projects
      </Link>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div>
          <EditableTitle projectId={projectId} name={project.name} />
          <p className="mt-1 text-sm text-muted-foreground">
            {project.files.length} file{project.files.length !== 1 ? "s" : ""} · {totalComments} comments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeleteProjectButton projectId={projectId} projectName={project.name} />
          <ArchiveProjectButton projectId={projectId} archived={project.archived} />
          {project.rounds.length > 0 && <ReanalyzeButton projectId={projectId} />}
          <GenerateDigestButton projectId={projectId} />
        </div>
      </div>

      {newCommentCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
          <TrendingUp className="size-4 text-primary shrink-0" />
          <span>
            <strong>{newCommentCount}</strong> new comment{newCommentCount !== 1 ? "s" : ""} since last analysis
          </span>
        </div>
      )}

      <ProjectAlerts alerts={projectAlerts} />

      <div className="mt-6" id="figma-token-section">
        <FigmaTokenField
          projectId={projectId}
          defaultValue={project.figmaAccessToken ?? null}
          autoOpen={hasTokenError}
        />
      </div>

      <FileManager
        projectId={projectId}
        files={project.files}
        hasTokenError={hasTokenError}
      />

      <section className="mt-8">
        <h2 className="font-heading text-base font-semibold mb-3">Analyses</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Each row counts threads added to that analysis (unresolved roots only). File cards show
          comments stored in scope.{" "}
          {unresolvedRootCount > 0
            ? `${unresolvedRootCount} unresolved root thread${unresolvedRootCount !== 1 ? "s" : ""} in this project right now.`
            : "No unresolved root threads (all may be resolved in Figma)."}
        </p>
        {project.rounds.length === 0 ? (
          <div className="glass rounded-lg p-8 text-center">
            <Clock className="size-6 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No analyses yet. Click &ldquo;Analyze Comments&rdquo; to get started.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" />
            <div className="space-y-2">
              {project.rounds.map((round, idx) => (
                <div
                  key={round.id}
                  className="glass-tint hover-lift relative flex items-stretch gap-0 rounded-lg py-3 pl-8 pr-3 sm:pr-4"
                >
                  <div
                    className={`absolute left-[7px] top-1/2 size-[10px] -translate-y-1/2 rounded-full border-2 border-primary ${idx === 0 ? "bg-primary" : "bg-background"}`}
                  />
                  <Link
                    href={`/project/${projectId}/digest?roundId=${round.id}`}
                    className="min-w-0 flex-1 rounded-md py-0.5 pr-2 outline-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="min-w-0 truncate">
                        {round.name ?? "Unnamed analysis"}
                      </span>
                      <Sparkles
                        className="size-4 shrink-0 text-primary/90"
                        aria-hidden
                      />
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquare className="size-3 shrink-0" />
                      <span>
                        {round.commentCount} in this analysis ·{" "}
                        {new Date(round.syncedAt).toLocaleDateString()}
                      </span>
                    </p>
                    {round.commentCount === 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                        Zero usually means every root thread was resolved in Figma or already used in
                        a prior analysis. Only unresolved roots are included.
                      </p>
                    )}
                    {round.files && round.files.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {round.files.map((f) => (
                          <Badge
                            key={f.name}
                            variant="secondary"
                            className="gap-1 px-1.5 py-0 text-[10px]"
                          >
                            {f.name} ({f.commentCount})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Link>
                  <div className="flex shrink-0 items-center self-center border-l border-border/50 pl-3 sm:pl-3.5">
                    <DeleteAnalysisButton
                      projectId={projectId}
                      roundId={round.id}
                      analysisLabel={round.name ?? "Analysis"}
                      afterDelete="refresh"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
