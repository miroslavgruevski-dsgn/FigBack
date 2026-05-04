"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteProjectButton({
  projectId,
  projectName,
  afterDelete = "home",
  className,
}: {
  projectId: string;
  projectName?: string;
  afterDelete?: "home" | "refresh";
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const label = projectName ?? "this project";

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (afterDelete === "refresh") {
          router.refresh();
          setConfirming(false);
        } else {
          router.push("/");
        }
        setDeleting(false);
        return;
      }
      let message = "Could not delete project.";
      try {
        const data = (await res.json()) as { error?: string };
        if (typeof data.error === "string") message = data.error;
      } catch {
        /* ignore */
      }
      toast.error(message);
    } catch {
      toast.error("Could not delete project. Check your connection and database.");
    }
    setDeleting(false);
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="glass rounded-lg p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-destructive">
          Delete <strong>{label}</strong> and all its data? This cannot be undone.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="rounded-lg"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className ?? "text-muted-foreground hover:text-destructive h-7 gap-1 text-xs"}
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="size-3.5" />
      Delete project
    </Button>
  );
}
