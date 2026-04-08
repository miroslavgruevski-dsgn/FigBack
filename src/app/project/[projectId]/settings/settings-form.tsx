"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  projectId: string;
  defaultName: string;
  defaultArchived: boolean;
  hasToken: boolean;
}

export function ProjectSettingsForm({ projectId, defaultName, defaultArchived, hasToken }: Props) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() !== defaultName) body.name = name.trim();
      if (token.trim()) body.figmaAccessToken = token.trim();

      if (Object.keys(body).length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error();
      toast.success("Settings saved");
      router.refresh();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !defaultArchived }),
      });
      if (!res.ok) throw new Error();
      toast.success(defaultArchived ? "Project restored" : "Project archived");
      router.push("/");
    } catch {
      toast.error("Failed to update");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch {
      toast.error("Failed to delete");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="glass rounded-lg p-5 space-y-4">
        <h2 className="font-heading text-base font-semibold">General</h2>
        <div className="space-y-2">
          <Label htmlFor="project-name">Project name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg max-w-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="figma-token">
            Figma access token
            {hasToken && <span className="text-muted-foreground ml-1">(set)</span>}
          </Label>
          <Input
            id="figma-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? "Leave blank to keep current" : "Paste token here"}
            className="rounded-lg max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            Overrides the global token for this project only.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="btn-gradient rounded-lg"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save changes
        </Button>
      </section>

      <section className="glass rounded-lg p-5 space-y-4 border-destructive/20">
        <h2 className="font-heading text-base font-semibold text-destructive">Danger zone</h2>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {defaultArchived ? "Restore project" : "Archive project"}
            </p>
            <p className="text-xs text-muted-foreground">
              {defaultArchived
                ? "Move this project back to the active list."
                : "Hide from the dashboard. Data is preserved."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg shrink-0"
            onClick={handleArchive}
            disabled={archiving}
          >
            {archiving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {defaultArchived ? "Restore" : "Archive"}
          </Button>
        </div>

        <div className="border-t border-border pt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Delete project</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete this project and all associated data.
            </p>
          </div>
          {confirmDelete ? (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setConfirmDelete(false)}
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
                {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Confirm
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg shrink-0"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
