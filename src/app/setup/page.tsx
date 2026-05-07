import Link from "next/link";
import { CheckCircle2, CircleDashed, Settings, ShieldCheck, Rocket } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManageSettings } from "@/lib/api-guards";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSetupStatus } from "@/lib/setup-status";

const checkLabels = {
  database: {
    title: "Database connected",
    hint: "Set DATABASE_URL and run migrations",
  },
  auth: {
    title: "Google auth configured",
    hint: "Set AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, and AUTH_SECRET",
  },
  figma: {
    title: "Figma token configured",
    hint: "Set FIGMA_ACCESS_TOKEN in env or in Settings",
  },
  llm: {
    title: "LLM provider configured",
    hint: "Set one LLM key in env or in Settings, or enable Skip LLM",
  },
  cron: {
    title: "Cron secret configured",
    hint: "Set CRON_SECRET for manual cron route calls",
  },
} as const;

export default async function SetupPage() {
  const status = await getSetupStatus();
  if (status.ready) {
    redirect("/");
  }
  const session = await auth();
  const canEditSettings = canManageSettings(session?.user?.email ?? null);
  const completedChecks = Object.values(status.checks).filter((v) => v === "ok").length;
  const totalChecks = Object.keys(status.checks).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="glass rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Rocket className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-semibold">Finish workspace setup</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete these checks once and your team can start using the portal.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
          <span className="font-medium">{completedChecks}/{totalChecks}</span> required checks are complete.
        </div>

        <div className="mt-5 space-y-2">
          {Object.entries(status.checks).map(([key, value]) => {
            const meta = checkLabels[key as keyof typeof checkLabels];
            return (
              <div
                key={key}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{meta.title}</p>
                  <p className="text-xs text-muted-foreground">{meta.hint}</p>
                </div>
                <span className="shrink-0 pt-0.5">
                  {value === "ok" ? (
                    <CheckCircle2 className="size-4 text-green-500" />
                  ) : (
                    <CircleDashed className="size-4 text-muted-foreground" />
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {!canEditSettings && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
            Your account cannot edit team settings. Ask a settings admin to complete setup.
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/settings" className={cn(buttonVariants(), "rounded-lg")}>
            <Settings className="mr-2 size-4" />
            Open settings
          </Link>
          <Link href="/setup" className={cn(buttonVariants({ variant: "outline" }), "rounded-lg")}>
            <ShieldCheck className="mr-2 size-4" />
            Recheck
          </Link>
        </div>
      </div>
    </div>
  );
}
