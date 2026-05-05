"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runJobQueueUntilIdle } from "@/lib/jobs/poll-client";
import { parseResponseJson } from "@/lib/parse-json-response";
import { toast } from "sonner";

export function GenerateDigestButton({
  projectId,
  disabledReason,
}: {
  projectId: string;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setStage("Starting...");
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = (await parseResponseJson<{
        roundId?: string;
        message?: string;
        jobId?: string;
        error?: string;
      }>(res)) ?? {};

      if (!res.ok) {
        toast.error(data.error ?? `Failed to start analysis (${res.status})`);
        return;
      }

      if (!data.roundId) {
        toast.error("Could not start analysis. Try again in a moment.");
        router.refresh();
        return;
      }
      if (data.message?.includes("already in progress")) {
        toast.message("Analysis already running", {
          description: "Finishing the current run. You can open it when the button stops loading.",
        });
      } else {
        toast.success("Analysis started!");
      }
      const pollResult = await runJobQueueUntilIdle({
        onProgress: (label) => setStage(label),
        projectId,
      });
      if (!pollResult.ok) {
        toast.warning("Couldn't confirm completion in this tab", {
          description:
            pollResult.error === "Timed out waiting for background jobs"
              ? "Analysis may still be running on the server. Refresh this page in a minute."
              : `${pollResult.error ?? "Network issue."} Refresh this page to check progress.`,
        });
        return;
      }
      router.push(`/project/${projectId}/digest?roundId=${data.roundId}`);
      router.refresh();
    } catch {
      toast.error("Failed to start analysis.");
    } finally {
      setLoading(false);
      setStage(null);
    }
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={loading || !!disabledReason}
      className="btn-gradient rounded-lg"
      title={disabledReason ?? "Analyze comments in current scope"}
    >
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 size-4" />
      )}
      {loading ? (stage ?? "Analyzing...") : "Analyze Comments"}
    </Button>
  );
}
