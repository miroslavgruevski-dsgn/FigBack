import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, AlertTriangle, Sparkles, MessageSquare } from "lucide-react";
import { GenerateDigestButton } from "./generate-button";
import { FigmaTokenField } from "./figma-token-field";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";

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
  figmaAccessToken?: string | null;
  files: {
    id: string;
    name: string;
    fileKey: string;
    url: string;
    lastSyncedAt: Date | null;
    lastError: string | null;
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
        <div className="mt-8">
          <ErrorState
            title="Failed to load project"
            description="We couldn't connect to the database. Check your DATABASE_URL or try again later."
          />
        </div>
      </div>
    );
  }

  if (!project) notFound();

  const totalComments = project.files.reduce((sum, f) => sum + f._count.comments, 0);
  const hasTokenError = project.files.some(
    (f) => f.lastError && (/token/i.test(f.lastError) || /403/.test(f.lastError))
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
          <h1 className="font-heading text-2xl font-semibold">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.files.length} file{project.files.length !== 1 ? "s" : ""} · {totalComments} comments
          </p>
        </div>
        <GenerateDigestButton projectId={projectId} />
      </div>

      <div className="mt-6" id="figma-token-section">
        <FigmaTokenField
          projectId={projectId}
          defaultValue={project.figmaAccessToken ?? null}
          autoOpen={hasTokenError}
        />
      </div>

      <section className="mt-8">
        <h2 className="font-heading text-base font-semibold mb-3">Figma Files</h2>
        <div className="glass rounded-lg p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {project.files.map((file) => {
              const hasError = !!file.lastError;
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-glass-hover transition-colors"
                >
                  <span className={`size-2 rounded-full shrink-0 ${hasError ? "bg-destructive" : "bg-figma-accent"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {file._count.comments} comments
                      {file.lastSyncedAt && ` · Synced ${new Date(file.lastSyncedAt).toLocaleDateString()}`}
                    </p>
                    {hasError && (
                      <p className="text-[11px] text-destructive mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span className="truncate">{file.lastError}</span>
                        {hasTokenError && (
                          <a href="#figma-token-section" className="underline underline-offset-2 shrink-0 ml-1">
                            Update token
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    aria-label={`Open ${file.name} in Figma`}
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-base font-semibold mb-3">Analyses</h2>
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
                <Link
                  key={round.id}
                  href={`/project/${projectId}/digest?roundId=${round.id}`}
                  className="glass-tint rounded-lg p-4 pl-8 flex items-center justify-between hover-lift relative block"
                >
                  <div className={`absolute left-[7px] size-[10px] rounded-full border-2 border-primary ${idx === 0 ? "bg-primary" : "bg-background"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{round.name ?? "Unnamed analysis"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MessageSquare className="size-3" />
                      {round.commentCount} comments · {new Date(round.syncedAt).toLocaleDateString()}
                    </p>
                    {round.files && round.files.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {round.files.map((f) => (
                          <Badge key={f.name} variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                            {f.name} ({f.commentCount})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Sparkles className="size-4 text-primary shrink-0 ml-3" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
