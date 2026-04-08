"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReanalyzeButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!roundId) return;

    cancelledRef.current = false;

    async function poll() {
      if (cancelledRef.current) return;
      try {
        const res = await fetch("/api/jobs/run", { method: "POST" });
        if (cancelledRef.current) return;
        const data = await res.json();

        if (data.status === "failed") {
          cleanup();
          setLoading(false);
          toast.error(`Job failed: ${data.error ?? "unknown error"}`);
          return;
        }

        if (data.message === "No pending jobs") {
          cleanup();
          setLoading(false);
          router.push(`/project/${projectId}/digest?roundId=${roundId}`);
          router.refresh();
          return;
        }

        if (data.hasMore) {
          setStage(formatJobType(data.nextType));
        } else {
          cleanup();
          setLoading(false);
          router.push(`/project/${projectId}/digest?roundId=${roundId}`);
          router.refresh();
        }
      } catch {
        if (!cancelledRef.current) {
          cleanup();
          setLoading(false);
          toast.error("Job processing failed");
        }
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return cleanup;
  }, [roundId, projectId, router, cleanup]);

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

      const data = await res.json();
      toast.success("Re-analysis started!");
      setRoundId(data.roundId);
    } catch {
      toast.error("Failed to start re-analysis.");
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

function formatJobType(type: string | null | undefined): string {
  switch (type) {
    case "classify": return "Classifying...";
    case "cluster": return "Clustering...";
    default: return "Finishing...";
  }
}
