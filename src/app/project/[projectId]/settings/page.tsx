import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/"
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

      <div className="glass mt-8 rounded-lg p-5">
        <p className="text-sm text-muted-foreground">
          Project configuration (rename, add/remove files, archive) coming in Phase 7.
        </p>
      </div>
    </div>
  );
}
