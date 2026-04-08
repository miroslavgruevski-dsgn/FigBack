import Link from "next/link";
import {
  Plus,
  MessageSquare,
  FolderOpen,
  FileText,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description: "Your Figma projects with active comment tracking.",
};

export const dynamic = "force-dynamic";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface ProjectFile {
  id: string;
  name: string;
  fileKey: string;
  lastError: string | null;
  lastSyncedAt: Date | null;
  url?: string;
  _count: { comments: number };
}

interface ProjectRound {
  id: string;
  name: string | null;
  syncedAt: Date;
  commentCount: number;
  cards?: { comment: { file: { name: string } } }[];
  files?: { name: string; commentCount: number }[];
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  files: ProjectFile[];
  _count: { rounds: number };
  rounds: ProjectRound[];
}

export default async function DashboardPage() {
  let projects: Project[] = [];
  let dbError = false;

  try {
    const { prisma } = await import("@/lib/db");
    projects = await prisma.project.findMany({
      where: { archived: false },
      include: {
        files: {
          select: { id: true, name: true, fileKey: true, lastError: true, lastSyncedAt: true, _count: { select: { comments: true } } },
        },
        _count: { select: { rounds: true } },
        rounds: {
          orderBy: { syncedAt: "desc" },
          take: 5,
          select: {
            id: true, name: true, syncedAt: true, commentCount: true,
            cards: { select: { comment: { select: { file: { select: { name: true } } } } } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }) as unknown as Project[];
  } catch {
    dbError = true;
  }

  const totalComments = projects.reduce(
    (sum, p) => sum + p.files.reduce((s, f) => s + f._count.comments, 0),
    0
  );
  const totalFiles = projects.reduce((sum, p) => sum + p.files.length, 0);
  const totalRounds = projects.reduce((sum, p) => sum + p._count.rounds, 0);
  const syncErrors = projects.reduce(
    (sum, p) => sum + p.files.filter((f) => f.lastError).length,
    0
  );

  const recentRounds = projects
    .flatMap((p) =>
      p.rounds.map((r) => {
        let files = r.files;
        if (!files && r.cards) {
          const fileCounts = new Map<string, number>();
          for (const card of r.cards) {
            const name = card.comment.file.name;
            fileCounts.set(name, (fileCounts.get(name) ?? 0) + 1);
          }
          files = [...fileCounts.entries()].map(([name, count]) => ({ name, commentCount: count }));
        }
        return {
          id: r.id, name: r.name, syncedAt: r.syncedAt, commentCount: r.commentCount,
          projectId: p.id,
          projectName: p.name,
          files,
        };
      })
    )
    .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Figma projects with active comment tracking.
          </p>
        </div>
        <Link href="/project/new" className={cn(buttonVariants(), "btn-gradient rounded-lg")}>
          <Plus className="mr-2 size-4" />
          New Project
        </Link>
      </div>

      {dbError ? (
        <div className="glass mt-8 flex items-center gap-3 rounded-lg p-4 text-sm">
          <AlertTriangle className="size-5 text-destructive shrink-0" />
          <div>
            <p className="font-medium">Database not connected</p>
            <p className="text-muted-foreground">
              Check your DATABASE_URL and try again.
            </p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={MessageSquare}
            title="No projects yet"
            description="Create your first project to start tracking Figma comments and generating smart design feedback digests."
          >
            <Link href="/project/new" className={cn(buttonVariants(), "btn-gradient rounded-lg")}>
              <Plus className="mr-2 size-4" />
              Create your first project
            </Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const comments = project.files.reduce((sum, f) => sum + f._count.comments, 0);
              const hasError = project.files.some((f) => f.lastError);
              return (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="glass glass-hover rounded-lg p-5 hover-lift"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      hasError ? "bg-destructive/10" : "bg-primary/10"
                    )}>
                      <FolderOpen className={cn("size-5", hasError ? "text-destructive" : "text-primary")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-heading text-base font-semibold truncate">{project.name}</h2>
                        {hasError && (
                          <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[11px] gap-1 px-1.5 py-0">
                          <FileText className="size-3" />
                          {project.files.length}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px] gap-1 px-1.5 py-0">
                          <MessageSquare className="size-3" />
                          {comments}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px] gap-1 px-1.5 py-0">
                          <Sparkles className="size-3" />
                          {project._count.rounds}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {project.files[0]?.lastSyncedAt && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Synced {timeAgo(new Date(project.files[0].lastSyncedAt))}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="glass rounded-lg px-4 py-3 text-center">
              <p className="text-2xl font-semibold font-heading">{totalComments}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Comments</p>
            </div>
            <div className="glass rounded-lg px-4 py-3 text-center">
              <p className="text-2xl font-semibold font-heading">{totalRounds}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Analyses</p>
            </div>
            <div className="glass rounded-lg px-4 py-3 text-center">
              <p className="text-2xl font-semibold font-heading">{totalFiles}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Files</p>
            </div>
            {syncErrors > 0 && (
              <div className="glass rounded-lg px-4 py-3 text-center">
                <p className="text-2xl font-semibold font-heading text-destructive">{syncErrors}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sync errors</p>
              </div>
            )}
          </div>

          {recentRounds.length > 0 && (
            <section className="mt-8">
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold mb-3">
                <Clock className="size-4 text-muted-foreground" />
                Recent Activity
              </h2>
              <div className="space-y-2">
                {recentRounds.map((r) => (
                  <Link
                    key={r.id}
                    href={`/project/${r.projectId}/digest?roundId=${r.id}`}
                    className="glass-tint rounded-lg px-4 py-3 flex items-center justify-between hover-lift"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.projectName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <MessageSquare className="size-3" />
                        {r.commentCount} comments · {r.name ?? timeAgo(new Date(r.syncedAt))}
                      </p>
                      {r.files && r.files.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.files.map((f) => (
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
