"use client";

import { useState } from "react";
import { Download, Share2, Link2, FileText, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseResponseJson } from "@/lib/parse-json-response";
import { toast } from "sonner";

interface DigestActionsProps {
  projectId: string;
  roundId: string;
}

export function DigestActions({ projectId, roundId }: DigestActionsProps) {
  const [sharing, setSharing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, roundId }),
      });

      if (!res.ok) {
        const data = await parseResponseJson<{ error?: string }>(res);
        toast.error(data?.error ?? "Failed to create share link");
        return;
      }

      const body = await parseResponseJson<{ shareUrl?: string }>(res);
      const shareUrl = body?.shareUrl;
      if (!shareUrl) {
        toast.error("Failed to create share link");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Share link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setSharing(false);
    }
  }

  function handleExport(format: "markdown" | "csv") {
    window.open(`/api/export?roundId=${roundId}&format=${format}`, "_blank");
    setShowExportMenu(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="rounded-lg gap-1.5 text-xs"
        onClick={handleShare}
        disabled={sharing}
      >
        {sharing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : copied ? (
          <Check className="size-3.5" />
        ) : (
          <Share2 className="size-3.5" />
        )}
        {copied ? "Copied" : "Share"}
      </Button>

      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg gap-1.5 text-xs"
          onClick={() => setShowExportMenu(!showExportMenu)}
        >
          <Download className="size-3.5" />
          Export
        </Button>

        {showExportMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowExportMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg">
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => handleExport("markdown")}
              >
                <FileText className="size-3.5" />
                Markdown
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => handleExport("csv")}
              >
                <Link2 className="size-3.5" />
                CSV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
