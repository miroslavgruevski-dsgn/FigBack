"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReanalyzeButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReanalyze() {
    setLoading(true);
    try {
      const res = await fetch("/api/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) throw new Error("Failed to start re-analysis");

      const { roundId } = await res.json();
      toast.success("Re-analysis started!");
      router.push(`/project/${projectId}/digest?roundId=${roundId}`);
    } catch {
      toast.error("Failed to start re-analysis.");
    } finally {
      setLoading(false);
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
      Re-analyze
    </Button>
  );
}
