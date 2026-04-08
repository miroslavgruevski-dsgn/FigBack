import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { ProjectSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  let project: { id: string; name: string; archived: boolean; figmaAccessToken: string | null } | null = null;
  let dbError = false;

  try {
    const { prisma } = await import("@/lib/db");
    project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, archived: true, figmaAccessToken: true },
    });
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ErrorState title="Failed to load settings" description="Check your database connection." />
      </div>
    );
  }

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/project/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to project
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="size-5 text-primary" />
        </div>
        <h1 className="font-heading text-2xl font-semibold">Project Settings</h1>
      </div>

      <ProjectSettingsForm
        projectId={projectId}
        defaultName={project.name}
        defaultArchived={project.archived}
        hasToken={!!project.figmaAccessToken}
      />
    </div>
  );
}
