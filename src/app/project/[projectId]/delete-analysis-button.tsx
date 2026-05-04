"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function DeleteAnalysisButton({
  projectId,
  roundId,
  analysisLabel,
  afterDelete,
  size = "sm",
  variant = "ghost",
}: {
  projectId: string;
  roundId: string;
  analysisLabel: string;
  afterDelete?: "refresh" | "go-project";
  size?: "sm" | "icon";
  variant?: "ghost" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/rounds/${roundId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Could not delete analysis");
        return;
      }
      toast.success("Analysis deleted");
      setOpen(false);
      if (afterDelete === "go-project") {
        router.push(`/project/${projectId}`);
      } else {
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={variant}
            size={size === "icon" ? "icon-sm" : "sm"}
            className={
              size === "icon"
                ? "text-muted-foreground hover:text-destructive shrink-0"
                : "text-destructive shrink-0 gap-1"
            }
            aria-label={`Delete analysis ${analysisLabel}`}
          >
            <Trash2 className="size-3.5" />
            {size !== "icon" && <span className="hidden sm:inline">Delete</span>}
          </Button>
        }
      />
      <DialogContent
        showCloseButton
        className="glass border-border/50 bg-background/85 sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/80 text-muted-foreground">
              <Trash2 className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-2 pt-0.5">
              <DialogTitle>Delete this analysis?</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{analysisLabel}</span> will be
                permanently removed. Share links to this analysis will stop working.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="border-border/40 bg-muted/30">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={() => setOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="rounded-lg"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete analysis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
