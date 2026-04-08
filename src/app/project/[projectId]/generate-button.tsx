"use client";

import { useState, useEffect, useRef } from "react";
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
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setLoading(false);
          toast.error(`Job failed: ${data.error ?? "unknown error"}`);
          return;
        }

        if (data.message === "all_done") {
          setLoading(false);
          router.push(`/project/${projectId}/digest?roundId=${roundId}`);
          router.refresh();
          return;
        }

        if (data.message === "jobs_running") {
          setStage(formatJobType(data.runningType));
          timerRef.current = setTimeout(poll, 2000);
          return;
        }

        if (data.hasMore && data.nextType !== "export_images") {
          setStage(formatJobType(data.nextType));
        } else {
          setLoading(false);
          router.push(`/project/${projectId}/digest?roundId=${roundId}`);
          router.refresh();
          return;
        }
      } catch {
        if (!cancelledRef.current) {
          setLoading(false);
          toast.error("Job processing failed");
          return;
        }
      }
      if (!cancelledRef.current) {
        timerRef.current = setTimeout(poll, 2000);
      }
    }

    poll();

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [roundId, projectId, router]);

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
    default: return "Processing...";
  }
}
