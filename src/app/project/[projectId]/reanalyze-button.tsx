"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runJobQueueUntilIdle } from "@/lib/jobs/poll-client";
import { parseResponseJson } from "@/lib/parse-json-response";
import { toast } from "sonner";

type ReanalyzeOk = {
  roundId?: string;
  message?: string;
  cardsCreated?: number;
  jobsQueued?: boolean;
  error?: string;
};

export function ReanalyzeButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  async function handleReanalyze() {
    setLoading(true);
    setStage("Queued...");
    try {
      const res = await fetch("/api/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = (await parseResponseJson<ReanalyzeOk>(res)) ?? {};

      if (!res.ok) {
        toast.error(data.error ?? `Couldn't start re-analysis (${res.status}).`);
        router.refresh();
        return;
      }

      if (data.message === "no_comments") {
        toast.message("Nothing to re-analyze", {
          description: "This project has no top-level comment threads yet.",
        });
        router.refresh();
        return;
      }

      if (data.message === "no_cards_created") {
        toast.warning("Nothing was added to this run.", {
          description: "Try syncing the file first, then run Re-analyze again.",
        });
        router.refresh();
        return;
      }

      if (!data.roundId) {
        toast.error("Could not start re-analysis.");
        router.refresh();
        return;
      }

      const jobsQueued = data.jobsQueued !== false;

      if (data.message?.includes("already in progress")) {
        toast.message("Re-analysis already running", {
          description: "Waiting for the background queue to finish.",
        });
      } else {
        toast.success("Re-analysis started!");
      }

      if (jobsQueued) {
        setStage("Preparing...");
        const pollResult = await runJobQueueUntilIdle({
          onProgress: (label) => setStage(label),
        });
        if (!pollResult.ok) {
          toast.warning("Couldn't confirm completion in this tab", {
            description:
              pollResult.error === "Timed out waiting for background jobs"
                ? "Jobs may still be running on the server. Refresh this page in a minute or open Digest."
                : `${pollResult.error ?? "Network or timeout."} Refresh this page or open Digest to see results.`,
          });
          router.refresh();
          return;
        }
      }

      router.push(`/project/${projectId}/digest?roundId=${data.roundId}`);
      router.refresh();
    } catch {
      toast.error("Failed to start re-analysis.");
    } finally {
      setLoading(false);
      setStage(null);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReanalyze}
      disabled={loading}
      className="rounded-lg gap-1.5 text-xs h-7"
      title="Re-classify existing comments with current LLM settings"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RefreshCw className="size-3.5" />
      )}
      {loading ? (stage ?? "Re-analyzing...") : "Re-analyze"}
    </Button>
  );
}
