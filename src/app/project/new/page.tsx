"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  function addUrl() {
    setUrls((prev) => [...prev, ""]);
  }

  function removeUrl(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function updateUrl(index: number, value: string) {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validUrls = urls.filter((u) => u.trim());
    if (!name.trim() || validUrls.length === 0) {
      toast.error("Enter a project name and at least one Figma URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), urls: validUrls }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create project");
      }
      toast.success("Project created!");
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <h1 className="mt-6 font-heading text-2xl font-semibold">New Project</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add a project and paste one or more Figma file URLs to start tracking comments.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Project name</Label>
          <Input
            id="name"
            placeholder="e.g. Checkout Redesign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg"
            required
          />
        </div>

        <div className="space-y-3">
          <Label>Figma file URLs</Label>
          {urls.map((url, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="https://www.figma.com/file/..."
                value={url}
                onChange={(e) => updateUrl(i, e.target.value)}
                className="rounded-lg"
              />
              {urls.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeUrl(i)}
                  className="shrink-0"
                  aria-label="Remove URL"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addUrl}
            className="rounded-lg"
          >
            <Plus className="mr-1.5 size-3.5" />
            Add another file
          </Button>
        </div>

        <Button type="submit" disabled={loading} className="w-full btn-gradient rounded-lg">
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Create Project
        </Button>
      </form>
    </div>
  );
}
