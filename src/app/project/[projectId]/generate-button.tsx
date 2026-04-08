"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GenerateDigestButton({
  projectId,
}: {
  projectId: string;
}) {
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

      const data = await res.json();
      toast.success("Analysis started!");
      setRoundId(data.roundId);
    } catch {
      toast.error("Failed to start analysis.");
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

function formatJobType(type: string | null | undefined): string {
  switch (type) {
    case "sync_full": return "Syncing comments...";
    case "export_images": return "Exporting images...";
    case "classify": return "Classifying...";
    case "cluster": return "Clustering...";
    default: return "Finishing...";
  }
}
