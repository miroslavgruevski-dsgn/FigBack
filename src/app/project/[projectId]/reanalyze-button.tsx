"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runJobQueueUntilIdle } from "@/lib/jobs/poll-client";
import { toast } from "sonner";

export function ReanalyzeButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  async function handleReanalyze() {
    setLoading(true);
    setStage("Starting...");
    try {
      const res = await fetch("/api/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) throw new Error("Failed to start re-analysis");

      const data = (await res.json()) as { roundId?: string; message?: string };
      if (!data.roundId) {
        toast.error("Could not start re-analysis. Try again in a moment.");
        router.refresh();
        return;
      }
      if (data.message?.includes("already in progress")) {
        toast.message("Re-analysis already running", {
          description: "Finishing the current run.",
        });
      } else {
        toast.success("Re-analysis started!");
      }
      const pollResult = await runJobQueueUntilIdle({
        onProgress: (label) => setStage(label),
      });
      if (!pollResult.ok) {
        toast.error(pollResult.error ?? "Job failed");
        return;
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
