"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runJobQueueUntilIdle } from "@/lib/jobs/poll-client";
import { toast } from "sonner";

export function GenerateDigestButton({
  projectId,
}: {
  projectId: string;
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

      if (!res.ok) throw new Error("Failed to start digest");

      const data = (await res.json()) as { roundId: string };
      toast.success("Analysis started!");
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
      toast.error("Failed to start analysis.");
    } finally {
      setLoading(false);
      setStage(null);
    }
  }

  return (
    <Button onClick={handleGenerate} disabled={loading} className="btn-gradient rounded-lg">
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 size-4" />
      )}
      {loading ? (stage ?? "Analyzing...") : "Analyze Comments"}
    </Button>
  );
}
