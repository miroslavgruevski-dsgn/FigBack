import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, TrendingUp } from "lucide-react";
import { GenerateDigestButton } from "./generate-button";
import { ReanalyzeButton } from "./reanalyze-button";
import { DeleteProjectButton } from "./delete-project-button";
import { ArchiveProjectButton } from "./archive-project-button";
import { EditableTitle } from "./editable-title";
import { FigmaTokenField } from "./figma-token-field";
import { FileManager } from "./file-manager";
import { AnalysisCardMenu } from "./analysis-card-menu";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { ProjectAlerts, type ProjectAlertItem } from "@/components/project/project-alerts";
import { summarizeIntegrationError } from "@/lib/integrations/error-summary";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type RoundWithFiles = {
  id: string;
  name: string | null;
  syncedAt: Date;
  commentCount: number;
  computedCardCount: number;
  openIssueCount: number;
  inProgressIssueCount: number;
  closedIssueCount: number;
  summarySource: "llm" | "heuristic" | null;
  aiSummary: string | null;
  aiTopIssues: string[];
  aiThemes: string[];
  previewUrls: string[];
  runType: "analysis" | "reanalysis";
  hasSameDayDuplicate: boolean;
  deltaLabel: string | null;
  noMaterialChange: boolean;
  manualStatus: "open" | "in_progress" | "done" | "none";
  allCommentsResolved: boolean;
  files?: { name: string; commentCount: number }[];
};

interface ProjectData {
  id: string;
  name: string;
  archived: boolean;
  hasProjectFigmaToken: boolean;
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

function formatJobProgress(type: string, payload?: Record<string, unknown>): string {
  const stage = typeof payload?.stage === "string" ? payload.stage : null;
  const label = typeof payload?.stageLabel === "string" ? payload.stageLabel : null;
  if (label) return label;

  const current = typeof payload?.progressCurrent === "number" ? payload.progressCurrent : null;
  const total = typeof payload?.progressTotal === "number" ? payload.progressTotal : null;
  const suffix = current !== null && total !== null && total > 0 ? ` ${current}/${total}` : "";

  if (stage === "queued") return "Queued";
  if (stage === "syncing") return `Syncing${suffix}`;
  if (stage === "preparing") return `Preparing cards${suffix}`;
  if (stage === "classifying") return `Classifying${suffix}`;
  if (stage === "clustering") return "Clustering";
  if (stage === "exporting_images") return `Exporting images${suffix}`;
  if (stage === "export_done") return "Done";

  switch (type) {
    case "prepare_reanalysis":
      return `Preparing threads${suffix}`;
    case "sync_full":
    case "sync_watch":
      return `Syncing comments${suffix}`;
    case "classify":
      return `Classifying${suffix}`;
    case "cluster":
      return "Clustering";
    case "export_images":
    case "export_images_file":
      return `Exporting images${suffix}`;
    default:
      return "Processing";
  }
}

function roundDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortRoundToken(id: string): string {
  return `#${id.slice(-6)}`;
}

function diffPrefix(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function manualStatusLabel(status: RoundWithFiles["manualStatus"]): string {
  switch (status) {
    case "done":
      return "Status: Done";
    case "in_progress":
      return "Status: In progress";
    case "open":
      return "Status: Open";
    default:
      return "Status: No issues";
  }
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
  let activeJob: { type: string; status: string; payload: Record<string, unknown> | null } | null =
    null;

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
            id: true,
            name: true,
            syncedAt: true,
            commentCount: true,
            executiveSummary: true,
            summarySource: true,
            cards: {
              select: {
                fullFrameUrl: true,
                comment: { select: { resolvedAt: true, file: { select: { name: true } } } },
              },
            },
          },
        },
        _count: { select: { rounds: true } },
      },
    });
    if (raw) {
      const roundIds = raw.rounds.map((r) => r.id);
      const issueCounts = roundIds.length
        ? await prisma.issueCluster.groupBy({
            by: ["roundId", "status"],
            where: { roundId: { in: roundIds } },
            _count: true,
          })
        : [];
      const issueCountByRound = new Map<string, { open: number; inProgress: number; closed: number }>();
      for (const row of issueCounts) {
        const existing = issueCountByRound.get(row.roundId) ?? { open: 0, inProgress: 0, closed: 0 };
        if (row.status === "done") {
          existing.closed += row._count;
        } else if (row.status === "in_progress") {
          existing.inProgress += row._count;
        } else if (row.status === "open" || row.status === "in_progress") {
          existing.open += row._count;
        }
        issueCountByRound.set(row.roundId, existing);
      }

      const roundsBase = raw.rounds.map((r) => {
        const fileCounts = new Map<string, number>();
        for (const card of r.cards) {
          const name = card.comment.file.name;
          fileCounts.set(name, (fileCounts.get(name) ?? 0) + 1);
        }
        let aiSummary: string | null = null;
        let aiTopIssues: string[] = [];
        let aiThemes: string[] = [];
        if (r.executiveSummary) {
          try {
            const parsed = JSON.parse(r.executiveSummary) as {
              summary?: string;
              topIssues?: string[];
              keyThemes?: string[];
            };
            aiSummary = typeof parsed.summary === "string" ? parsed.summary : null;
            aiTopIssues = Array.isArray(parsed.topIssues)
              ? parsed.topIssues.filter((v): v is string => typeof v === "string").slice(0, 2)
              : [];
            aiThemes = Array.isArray(parsed.keyThemes)
              ? parsed.keyThemes.filter((v): v is string => typeof v === "string").slice(0, 2)
              : [];
          } catch {
            // keep defaults when summary is not valid JSON
          }
        }
        const previewUrls = [
          ...new Set(
            r.cards
              .map((card) => card.fullFrameUrl)
              .filter((u): u is string => typeof u === "string" && u.length > 0)
          ),
        ].slice(0, 3);
        const issueCountsForRound = issueCountByRound.get(r.id) ?? {
          open: 0,
          inProgress: 0,
          closed: 0,
        };
        const runType = r.name?.toLowerCase().startsWith("re-analysis")
          ? "reanalysis"
          : "analysis";
        const totalIssues =
          issueCountsForRound.open + issueCountsForRound.inProgress + issueCountsForRound.closed;
        const manualStatus: RoundWithFiles["manualStatus"] =
          totalIssues === 0
            ? "none"
            : issueCountsForRound.closed === totalIssues
              ? "done"
              : issueCountsForRound.inProgress > 0
                ? "in_progress"
                : "open";
        const allCommentsResolved =
          r.cards.length > 0 && r.cards.every((card) => card.comment.resolvedAt !== null);
        return {
          id: r.id,
          name: r.name,
          syncedAt: r.syncedAt,
          commentCount: r.commentCount,
          computedCardCount: r.cards.length,
          openIssueCount: issueCountsForRound.open,
          inProgressIssueCount: issueCountsForRound.inProgress,
          closedIssueCount: issueCountsForRound.closed,
          summarySource:
            r.summarySource === "heuristic" || r.summarySource === "llm"
              ? r.summarySource
              : null,
          aiSummary,
          aiTopIssues,
          aiThemes,
          previewUrls,
          runType,
          hasSameDayDuplicate: false,
          deltaLabel: null,
          noMaterialChange: false,
          manualStatus,
          allCommentsResolved,
          files: [...fileCounts.entries()].map(([name, count]) => ({ name, commentCount: count })),
        };
      });
      const dayCounts = new Map<string, number>();
      for (const round of roundsBase) {
        const key = roundDayKey(round.syncedAt);
        dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
      }
      const rounds = roundsBase.map((round, idx) => {
        const previous = roundsBase[idx + 1];
        if (!previous) {
          return {
            ...round,
            hasSameDayDuplicate: (dayCounts.get(roundDayKey(round.syncedAt)) ?? 0) > 1,
            deltaLabel: "Baseline run",
            noMaterialChange: false,
          };
        }
        const deltaComments = round.computedCardCount - previous.computedCardCount;
        const deltaOpen = round.openIssueCount - previous.openIssueCount;
        const deltaClosed = round.closedIssueCount - previous.closedIssueCount;
        const summaryA = (round.aiSummary ?? "").trim().toLowerCase();
        const summaryB = (previous.aiSummary ?? "").trim().toLowerCase();
        const noMaterialChange =
          deltaComments === 0 &&
          deltaOpen === 0 &&
          deltaClosed === 0 &&
          round.summarySource === previous.summarySource &&
          summaryA === summaryB;
        const deltaLabel = noMaterialChange
          ? "No material change from previous run"
          : `${diffPrefix(deltaComments)} comments · ${diffPrefix(deltaOpen)} open issues · ${diffPrefix(deltaClosed)} closed`;
        return {
          ...round,
          hasSameDayDuplicate: (dayCounts.get(roundDayKey(round.syncedAt)) ?? 0) > 1,
          deltaLabel,
          noMaterialChange,
        };
      });
      for (const r of rounds) {
        if (r.commentCount !== r.computedCardCount) {
          logger.warn("Project page round count mismatch", {
            roundId: r.id,
            storedCount: r.commentCount,
            computedCount: r.computedCardCount,
          });
        }
      }
      const { figmaAccessToken, ...rest } = raw;
      project = {
        ...rest,
        rounds,
        hasProjectFigmaToken: Boolean(figmaAccessToken),
      } as unknown as ProjectData;

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

      const [failedJobRow, teamCfg, ur, activeJobRow] = await Promise.all([
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
        prisma.job.findFirst({
          where: { projectId, status: { in: ["pending", "running", "waiting"] } },
          orderBy: { createdAt: "desc" },
          select: { type: true, status: true, payload: true },
        }),
      ]);
      unresolvedRootCount = ur;
      activeJob = activeJobRow
        ? {
            type: activeJobRow.type,
            status: activeJobRow.status,
            payload: activeJobRow.payload as Record<string, unknown>,
          }
        : null;

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
          detail: summarizeIntegrationError(teamCfg.lastIntegrationError),
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

  const filesForUi = project.files;

  const totalComments = filesForUi.reduce((sum, f) => sum + f._count.comments, 0);
  const hasFilesLinked = filesForUi.length > 0;
  const hasSyncedAnyFile = filesForUi.some((f) => !!f.lastSyncedAt);
  const scopedFiles = filesForUi.filter(
    (f) =>
      (f.includedPages?.length ?? 0) > 0 || (f.includedFrames?.length ?? 0) > 0
  );
  const scopedStoredCount = scopedFiles.reduce((sum, f) => sum + f._count.comments, 0);
  const analyzeDisabledReason = !hasFilesLinked
    ? "Link at least one Figma file first."
    : !hasSyncedAnyFile
      ? "Sync project first."
      : scopedFiles.length > 0 && scopedStoredCount === 0
        ? "No comments in selected scope. Adjust Scope or sync again."
        : null;
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
            {filesForUi.length} file{filesForUi.length !== 1 ? "s" : ""} · {totalComments} comments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeleteProjectButton projectId={projectId} projectName={project.name} />
          <ArchiveProjectButton projectId={projectId} archived={project.archived} />
          {project.rounds.length > 0 && <ReanalyzeButton projectId={projectId} />}
          <GenerateDigestButton
            projectId={projectId}
            disabledReason={analyzeDisabledReason}
          />
        </div>
      </div>
      {analyzeDisabledReason && (
        <p className="mt-2 text-xs text-muted-foreground">{analyzeDisabledReason}</p>
      )}

      {newCommentCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
          <TrendingUp className="size-4 text-primary shrink-0" />
          <span>
            <strong>{newCommentCount}</strong> new comment{newCommentCount !== 1 ? "s" : ""} since last analysis
          </span>
        </div>
      )}
      {activeJob && (
        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm">
          <p className="font-medium text-foreground">Background processing</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatJobProgress(activeJob.type, activeJob.payload ?? undefined)}{" "}
            <span className="uppercase tracking-wide">({activeJob.status})</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Queued - Syncing - Preparing cards - Classifying - Clustering - Exporting images - Done
          </p>
        </div>
      )}

      <ProjectAlerts alerts={projectAlerts} />

      <div className="mt-6" id="figma-token-section">
        <FigmaTokenField
          projectId={projectId}
          hasProjectOverride={project.hasProjectFigmaToken}
          autoOpen={hasTokenError}
        />
      </div>

      <FileManager
        projectId={projectId}
        files={filesForUi}
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
                  className="glass-tint hover-lift relative rounded-lg py-3 pl-8 pr-3 sm:pr-4"
                >
                  <div
                    className={`absolute left-[7px] top-1/2 size-[10px] -translate-y-1/2 rounded-full border-2 border-primary ${idx === 0 ? "bg-primary" : "bg-background"}`}
                  />
                  <Link
                    href={`/project/${projectId}/digest?roundId=${round.id}`}
                    className="min-w-0 block rounded-md py-0.5 pr-12 outline-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="min-w-0 truncate">
                        {round.runType === "reanalysis" ? "Re-analysis" : "Analysis"} ·{" "}
                        {new Date(round.syncedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {idx === 0 && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          Latest
                        </Badge>
                      )}
                      {round.hasSameDayDuplicate && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {shortRoundToken(round.id)}
                        </Badge>
                      )}
                    </p>
                  {(() => {
                    const displayCount =
                      round.commentCount === round.computedCardCount
                        ? round.commentCount
                        : round.computedCardCount;
                    const countWasRepaired = round.commentCount !== round.computedCardCount;
                    return (
                      <>
                        <p className="mt-1 text-[11px] text-foreground/85">
                          {displayCount} comments · {round.openIssueCount} open · {round.closedIssueCount} closed
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            {manualStatusLabel(round.manualStatus)}
                          </Badge>
                          {round.allCommentsResolved && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              Comments: All resolved
                            </Badge>
                          )}
                        </div>
                        <p
                          className={`mt-1 text-[11px] ${round.noMaterialChange ? "text-muted-foreground" : "text-foreground/80"}`}
                        >
                          {round.deltaLabel}
                        </p>
                        {countWasRepaired && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Count refreshed.
                          </p>
                        )}
                      </>
                    );
                  })()}
                    <div className="mt-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-foreground">AI at a glance</p>
                        {round.summarySource === "heuristic" && (
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              fallback mode
                            </Badge>
                            <span
                              className="inline-flex size-4 items-center justify-center rounded-full border border-border/70 text-[10px] text-muted-foreground"
                              title="Shown when AI summary used fallback because the LLM was unavailable or rate-limited."
                              aria-label="Fallback mode info"
                            >
                              i
                            </span>
                          </div>
                        )}
                      </div>
                      {round.aiSummary ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-1">
                          {round.aiSummary}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Summary appears after classification and clustering finish.
                        </p>
                      )}
                    </div>
                    <details className="mt-2 rounded-md border border-border/50 bg-background/25 px-2.5 py-2">
                      <summary className="cursor-pointer text-[11px] text-muted-foreground">Details</summary>
                      {(round.aiTopIssues.length > 0 || round.aiThemes.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {[...round.aiTopIssues, ...round.aiThemes].slice(0, 2).map((item) => (
                            <Badge
                              key={`${round.id}-highlight-${item}`}
                              variant="secondary"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {item}
                            </Badge>
                          ))}
                          {[...round.aiTopIssues, ...round.aiThemes].length > 2 && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              +{[...round.aiTopIssues, ...round.aiThemes].length - 2} more
                            </Badge>
                          )}
                        </div>
                      )}
                      {round.previewUrls.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] font-medium text-foreground/90">Figma previews</p>
                          <div className="mt-1.5 flex gap-1.5">
                            {round.previewUrls.map((url, i) => (
                              <div
                                key={`${round.id}-preview-${i}`}
                                className="h-14 w-20 rounded-md border border-border/70 bg-muted/40 bg-cover bg-center"
                                style={{ backgroundImage: `url("${url}")` }}
                                aria-label={`Preview ${i + 1}`}
                              />
                            ))}
                          </div>
                        </div>
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
                      {round.computedCardCount === 0 && (
                        <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                          Zero usually means every root thread was resolved in Figma or already used in a prior analysis.
                        </p>
                      )}
                    </details>
                  </Link>
                  <div className="absolute right-3 top-3">
                    <AnalysisCardMenu
                      projectId={projectId}
                      roundId={round.id}
                      analysisLabel={round.name ?? "Analysis"}
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
