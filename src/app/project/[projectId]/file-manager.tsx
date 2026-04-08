"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Settings2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FigmaFileData {
  id: string;
  name: string;
  fileKey: string;
  url: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
  includedPages?: string[];
  _count: { comments: number };
}

interface FileManagerProps {
  projectId: string;
  files: FigmaFileData[];
  hasTokenError: boolean;
}

export function FileManager({ projectId, files, hasTokenError }: FileManagerProps) {
  const router = useRouter();
  const [showAddInput, setShowAddInput] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configureFileId, setConfigureFileId] = useState<string | null>(null);

  async function handleAdd() {
    if (!newUrl.trim()) return;
    setAdding(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add file");
        return;
      }

      setNewUrl("");
      setShowAddInput(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm("Remove this Figma file? Its comments will also be deleted.")) return;
    setDeletingId(fileId);

    try {
      await fetch(`/api/projects/${projectId}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      router.refresh();
    } catch {
      setError("Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-base font-semibold">Figma Files</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => {
            setShowAddInput(!showAddInput);
            setError(null);
          }}
        >
          <Plus className="size-3.5" />
          Add file
        </Button>
      </div>

      <div className="glass rounded-lg p-3">
        {showAddInput && (
          <div className="mb-3 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://www.figma.com/file/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="rounded-lg text-sm"
                autoFocus
              />
              <Button
                size="sm"
                className="btn-gradient rounded-lg shrink-0"
                onClick={handleAdd}
                disabled={adding || !newUrl.trim()}
              >
                {adding ? <Loader2 className="size-4 animate-spin" /> : "Add"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 px-2"
                onClick={() => {
                  setShowAddInput(false);
                  setNewUrl("");
                  setError(null);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        )}

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No Figma files linked yet. Add one above.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {files.map((file) => {
              const hasError = !!file.lastError;
              const isDeleting = deletingId === file.id;
              return (
                <div key={file.id}>
                  <div className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-glass-hover transition-colors group">
                    <span
                      className={`size-2 rounded-full shrink-0 ${hasError ? "bg-destructive" : "bg-figma-accent"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {file._count.comments} comments
                        {file.lastSyncedAt &&
                          ` · Synced ${new Date(file.lastSyncedAt).toLocaleDateString()}`}
                      </p>
                      {hasError && (
                        <p className="text-[11px] text-destructive mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="size-3 shrink-0" />
                          <span className="truncate">{file.lastError}</span>
                          {hasTokenError && (
                            <a
                              href="#figma-token-section"
                              className="underline underline-offset-2 shrink-0 ml-1"
                            >
                              Update token
                            </a>
                          )}
                        </p>
                      )}
                      {file.includedPages && file.includedPages.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {file.includedPages.length} page{file.includedPages.length !== 1 ? "s" : ""} selected
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() =>
                          setConfigureFileId(configureFileId === file.id ? null : file.id)
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 p-1"
                        aria-label={`Configure pages for ${file.name}`}
                      >
                        <Settings2 className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        disabled={isDeleting}
                        className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 p-1"
                        aria-label={`Remove ${file.name}`}
                      >
                        {isDeleting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        aria-label={`Open ${file.name} in Figma`}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  </div>

                  {configureFileId === file.id && (
                    <PageSelector
                      projectId={projectId}
                      file={file}
                      onClose={() => setConfigureFileId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

interface PageSelectorProps {
  projectId: string;
  file: FigmaFileData;
  onClose: () => void;
}

function PageSelector({ projectId, file, onClose }: PageSelectorProps) {
  const router = useRouter();
  const [pages, setPages] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(file.includedPages ?? [])
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `/api/projects/${projectId}/files/pages?fileId=${file.id}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch pages");
        return res.json();
      })
      .then((data) => {
        setPages(data.pages);
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err.message);
        setLoading(false);
      });
  }, [projectId, file.id]);

  function togglePage(pageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: file.id,
          includedPages: [...selected],
        }),
      });
      router.refresh();
      onClose();
    } catch {
      setFetchError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-3 mb-2 rounded-md border border-border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">
          Select pages to include
          <span className="text-muted-foreground ml-1">(empty = all pages)</span>
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : fetchError ? (
        <p className="text-xs text-destructive">{fetchError}</p>
      ) : pages && pages.length > 0 ? (
        <>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {pages.map((page) => (
              <label
                key={page.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
              >
                <div
                  className={`size-4 rounded border flex items-center justify-center transition-colors ${
                    selected.has(page.id)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {selected.has(page.id) && <Check className="size-3" />}
                </div>
                {page.name}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 rounded-lg text-xs"
              onClick={() => setSelected(new Set())}
            >
              Clear all
            </Button>
            <Button
              size="sm"
              className="flex-1 btn-gradient rounded-lg text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No pages found in this file.</p>
      )}
    </div>
  );
}
