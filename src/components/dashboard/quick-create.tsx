"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function QuickCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !url.trim()) {
      toast.error("Enter a name and Figma URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), urls: [url.trim()] }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }

      toast.success("Project created!");
      setName("");
      setUrl("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass glass-hover rounded-lg p-5 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border"
      >
        <Plus className="size-4" />
        Quick create
      </button>
    );
  }

  return (
    <div className="glass rounded-lg p-4 space-y-3 border border-primary/30">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">New project</p>
        <button
          onClick={() => { setOpen(false); setName(""); setUrl(""); }}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Input
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-lg text-sm h-8"
        autoFocus
      />
      <Input
        placeholder="https://www.figma.com/file/..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        className="rounded-lg text-sm h-8"
      />
      <Button
        size="sm"
        className="w-full btn-gradient rounded-lg text-xs"
        onClick={handleCreate}
        disabled={loading || !name.trim() || !url.trim()}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}
      </Button>
    </div>
  );
}
