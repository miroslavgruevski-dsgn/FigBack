"use client";

import { useState, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
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
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { runJobQueueUntilIdle } from "@/lib/jobs/poll-client";
import { parseResponseJson } from "@/lib/parse-json-response";
import { toast } from "sonner";

interface FigmaFileData {
  id: string;
  name: string;
  fileKey: string;
  url: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
  includedPages?: string[];
  includedFrames?: string[];
  lastSyncFigmaCommentTotal?: number | null;
  lastSyncImportedCount?: number | null;
  lastSyncSkippedScopeCount?: number | null;
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
  const [syncing, setSyncing] = useState(false);
  const [syncStage, setSyncStage] = useState<string | null>(null);

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
        const data = await parseResponseJson<{ error?: string }>(res);
        setError(data?.error ?? "Failed to add file");
        return;
      }

      setNewUrl("");
      setShowAddInput(false);
      toast.success("File linked", {
        description:
          "Open Scope on the card to choose page(s). Only comments on selected pages are stored.",
      });
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

  async function handleSyncProject() {
    if (files.length === 0) return;
    setSyncing(true);
    setSyncStage("Starting...");
    setError(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = (await parseResponseJson<{ error?: string }>(res)) ?? {};
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
        return;
      }
      toast.message("Sync queued", {
        description: "Updating comments from Figma. This may take a minute.",
      });
      const pollResult = await runJobQueueUntilIdle({
        onProgress: (label) => setSyncStage(label),
        projectId,
      });
      if (!pollResult.ok) {
        toast.warning("Couldn't confirm completion in this tab", {
          description:
            pollResult.error === "Timed out waiting for background jobs"
              ? "Sync may still be running on the server. Refresh this page in a minute."
              : `${pollResult.error ?? "Network issue."} Refresh this page to check current status.`,
        });
        return;
      }
      toast.success("Sync complete");
      router.refresh();
    } catch {
      setError("Sync failed");
      toast.error("Sync failed");
    } finally {
      setSyncStage(null);
      setSyncing(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h2 className="font-heading text-base font-semibold">Figma Files</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs rounded-lg"
            type="button"
            disabled={syncing || files.length === 0}
            title="Syncs every linked Figma file in this project (comments and metadata)."
            onClick={handleSyncProject}
          >
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {syncing ? syncStage ?? "Syncing..." : "Sync project"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            type="button"
            onClick={() => {
              setShowAddInput(!showAddInput);
              setError(null);
            }}
          >
            <Plus className="size-3.5" />
            Add file
          </Button>
        </div>
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
          <div
            className={cn(
              "grid gap-3",
              files.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
            )}
          >
            {files.map((file) => {
              const hasError = !!file.lastError;
              const isDeleting = deletingId === file.id;
              const hasScope =
                (file.includedPages?.length ?? 0) > 0 ||
                (file.includedFrames?.length ?? 0) > 0;
              const figmaTotal = file.lastSyncFigmaCommentTotal ?? null;
              const skippedScope = file.lastSyncSkippedScopeCount ?? null;
              const scopeExcludedAll =
                hasScope &&
                figmaTotal !== null &&
                figmaTotal > 0 &&
                (file.lastSyncImportedCount ?? 0) === 0 &&
                file._count.comments === 0;
              return (
                <div key={file.id}>
                  <div className="rounded-xl border border-border/50 bg-background/40 p-3 sm:p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`size-2 rounded-full shrink-0 mt-1.5 ${hasError ? "bg-destructive" : "bg-figma-accent"}`}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium leading-snug">{file.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {hasScope
                            ? `Stored in scope now: ${file._count.comments}`
                            : `Stored comments: ${file._count.comments}`}
                          {file.lastSyncedAt &&
                            ` · Synced ${new Date(file.lastSyncedAt).toLocaleDateString()}`}
                        </p>
                        {file.lastSyncImportedCount !== null &&
                          file.lastSyncImportedCount !== undefined && (
                            <p className="text-[10px] text-muted-foreground/90 leading-snug">
                              Latest run imported: {file.lastSyncImportedCount} comment
                              {file.lastSyncImportedCount !== 1 ? "s" : ""}
                            </p>
                          )}
                        {figmaTotal !== null && (
                          <p className="text-[10px] text-muted-foreground/90 leading-snug">
                            Last sync API total: {figmaTotal} comment
                            {figmaTotal !== 1 ? "s" : ""}
                            {hasScope && skippedScope !== null && skippedScope > 0
                              ? ` · Excluded by scope: ${skippedScope}`
                              : ""}
                          </p>
                        )}
                        {!hasScope && (
                          <p className="text-[10px] text-muted-foreground">
                            Optional: use Scope to limit which pages sync.
                          </p>
                        )}
                        {scopeExcludedAll && (
                          <p className="text-[11px] text-amber-800 dark:text-amber-200 flex gap-1 items-start mt-0.5">
                            <AlertTriangle className="size-3 shrink-0 mt-0.5" />
                            <span>
                              Every Figma comment was outside your selected pages or frames. Adjust
                              Scope or pick pages where comments live.
                            </span>
                          </p>
                        )}
                        {hasError && (
                          <p className="text-[11px] text-destructive flex flex-wrap items-center gap-x-1 gap-y-0.5">
                            <AlertTriangle className="size-3 shrink-0" />
                            <span className="break-words">{file.lastError}</span>
                            {hasTokenError && (
                              <a
                                href="#figma-token-section"
                                className="underline underline-offset-2 shrink-0"
                              >
                                Update token
                              </a>
                            )}
                          </p>
                        )}
                        {((file.includedPages && file.includedPages.length > 0) ||
                          (file.includedFrames && file.includedFrames.length > 0)) && (
                          <p className="text-[11px] text-muted-foreground">
                            {[
                              file.includedPages?.length
                                ? `${file.includedPages.length} page${file.includedPages.length !== 1 ? "s" : ""}`
                                : null,
                              file.includedFrames?.length
                                ? `${file.includedFrames.length} frame${file.includedFrames.length !== 1 ? "s" : ""}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(", ")}{" "}
                            selected
                          </p>
                        )}
                      </div>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-8 gap-1 text-xs rounded-lg shrink-0 inline-flex"
                        )}
                      >
                        <ExternalLink className="size-3.5" />
                        Open
                      </a>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs rounded-lg"
                        onClick={() =>
                          setConfigureFileId(configureFileId === file.id ? null : file.id)
                        }
                      >
                        <Settings2 className="size-3.5" />
                        Scope
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs rounded-lg"
                        disabled={syncing}
                        title="Syncs every linked file in this project"
                        onClick={handleSyncProject}
                      >
                        {syncing ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        {syncing ? syncStage ?? "Syncing..." : "Sync project"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={isDeleting}
                        onClick={() => handleDelete(file.id)}
                      >
                        {isDeleting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Remove
                      </Button>
                    </div>
                  </div>

                  {configureFileId === file.id && (
                    <PageSelector
                      projectId={projectId}
                      file={file}
                      hasTokenError={hasTokenError}
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

interface PageNode {
  id: string;
  name: string;
  children?: { id: string; name: string; type: string }[];
}

interface PageSelectorProps {
  projectId: string;
  file: FigmaFileData;
  hasTokenError: boolean;
  onClose: () => void;
}

type ScopePreset = "full" | "limited";

function PageSelector({ projectId, file, hasTokenError, onClose }: PageSelectorProps) {
  const router = useRouter();
  const initialHasSelection =
    (file.includedPages?.length ?? 0) > 0 || (file.includedFrames?.length ?? 0) > 0;
  const [scopePreset, setScopePreset] = useState<ScopePreset>(
    initialHasSelection ? "limited" : "full"
  );
  const [pages, setPages] = useState<PageNode[] | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(
    new Set(file.includedPages ?? [])
  );
  const [selectedFrames, setSelectedFrames] = useState<Set<string>>(
    new Set(file.includedFrames ?? [])
  );
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  /** Index in `pages` for Shift+click range selection between pages */
  const pageRangeAnchorRef = useRef<number | null>(null);
  /** Sibling index under `pageId` for Shift+click among frames on one page */
  const frameRangeAnchorRef = useRef<{ pageId: string; index: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/files/pages?fileId=${file.id}`)
      .then(async (res) => {
        const data = await parseResponseJson<{
          pages?: PageNode[];
          error?: string;
        }>(res);
        if (!res.ok) {
          throw new Error(
            data?.error ??
              "Could not load pages from Figma. Check your token and that the file is reachable."
          );
        }
        if (!data?.pages) {
          throw new Error(data?.error ?? "Unexpected response while loading pages.");
        }
        if (!cancelled) {
          setPages(data.pages);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Failed to fetch pages");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, file.id]);

  function togglePage(pageId: string) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }

  function handlePageClick(pageId: string, pageIndex: number, e: MouseEvent) {
    if (!pages) return;
    if (e.shiftKey && pageRangeAnchorRef.current !== null) {
      const from = Math.min(pageRangeAnchorRef.current, pageIndex);
      const to = Math.max(pageRangeAnchorRef.current, pageIndex);
      setSelectedPages((prev) => {
        const next = new Set(prev);
        for (let i = from; i <= to; i++) {
          next.add(pages[i].id);
        }
        return next;
      });
      return;
    }
    pageRangeAnchorRef.current = pageIndex;
    togglePage(pageId);
  }

  function toggleFrame(frameId: string) {
    setSelectedFrames((prev) => {
      const next = new Set(prev);
      if (next.has(frameId)) {
        next.delete(frameId);
      } else {
        next.add(frameId);
      }
      return next;
    });
  }

  function handleFrameClick(
    frameId: string,
    pageId: string,
    siblingIndex: number,
    siblings: { id: string }[],
    e: MouseEvent
  ) {
    if (
      e.shiftKey &&
      frameRangeAnchorRef.current?.pageId === pageId &&
      frameRangeAnchorRef.current !== null
    ) {
      const from = Math.min(frameRangeAnchorRef.current.index, siblingIndex);
      const to = Math.max(frameRangeAnchorRef.current.index, siblingIndex);
      setSelectedFrames((prev) => {
        const next = new Set(prev);
        for (let i = from; i <= to; i++) {
          const f = siblings[i];
          if (f) next.add(f.id);
        }
        return next;
      });
      return;
    }
    frameRangeAnchorRef.current = { pageId, index: siblingIndex };
    toggleFrame(frameId);
  }

  function toggleExpand(pageId: string) {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }

  function selectAll() {
    if (!pages) return;
    const allPageIds = new Set(pages.map((p) => p.id));
    const allFrameIds = new Set(
      pages.flatMap((p) => (p.children ?? []).map((c) => c.id))
    );
    setSelectedPages(allPageIds);
    setSelectedFrames(allFrameIds);
  }

  function clearAll() {
    pageRangeAnchorRef.current = null;
    frameRangeAnchorRef.current = null;
    setSelectedPages(new Set());
    setSelectedFrames(new Set());
  }

  function expandAll() {
    if (!pages) return;
    setExpandedPages(new Set(pages.map((p) => p.id)));
  }

  function collapseExpand() {
    setExpandedPages(new Set());
  }

  async function handleSave() {
    if (scopePreset === "limited" && selectedPages.size === 0 && selectedFrames.size === 0) {
      toast.error("Select at least one page or frame", {
        description: "Or switch to Full file to sync everything.",
      });
      return;
    }

    const includedPages = scopePreset === "full" ? [] : [...selectedPages];
    const includedFrames = scopePreset === "full" ? [] : [...selectedFrames];

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: file.id,
          includedPages,
          includedFrames,
          pruneOutOfScope: true,
        }),
      });
      if (!res.ok) {
        const data = await parseResponseJson<{ error?: string }>(res);
        toast.error(data?.error ?? "Could not save scope");
        return;
      }
      toast.success(
        scopePreset === "full"
          ? "Scope: full file"
          : `Scope: ${includedPages.length} page${includedPages.length !== 1 ? "s" : ""}${
              includedFrames.length
                ? `, ${includedFrames.length} frame${includedFrames.length !== 1 ? "s" : ""}`
                : ""
            }`
      );
      router.refresh();
      onClose();
    } catch {
      setFetchError("Failed to save");
      toast.error("Failed to save scope");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-3 mb-2 rounded-md border border-border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Sync scope</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex rounded-lg border border-border p-0.5 gap-0.5">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md py-2 text-xs font-medium transition-colors",
            scopePreset === "full"
              ? "bg-muted text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setScopePreset("full")}
        >
          Full file
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md py-2 text-xs font-medium transition-colors",
            scopePreset === "limited"
              ? "bg-muted text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setScopePreset("limited")}
        >
          Selected pages
        </button>
      </div>

      {scopePreset === "full" ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Every page is included when you sync. Switch to <strong className="text-foreground">Selected pages</strong>{" "}
          to store comments only from specific canvases or frames.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Click pages to turn them on or off (multiple allowed).{" "}
          <strong className="text-foreground">Shift-click</strong> a second page to select every page in between. Expand a page to pick{" "}
          <strong className="text-foreground">frames</strong> only.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : fetchError ? (
        <div className="space-y-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5">
          <p className="text-xs text-destructive leading-relaxed">{fetchError}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Use a{" "}
            <a
              href="https://www.figma.com/developers/api#access-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 text-foreground"
            >
              Figma personal access token
            </a>{" "}
            with file read access to this file. Add it in{" "}
            <a href="#figma-token-section" className="underline underline-offset-2 text-foreground">
              this project
            </a>{" "}
            or{" "}
            <a href="/settings" className="underline underline-offset-2 text-foreground">
              Settings
            </a>
            .
            {hasTokenError ? (
              <>
                {" "}
                The token field below may need updating.
              </>
            ) : null}
          </p>
        </div>
      ) : pages && pages.length > 0 ? (
        <>
          {scopePreset === "limited" ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-md text-[10px] px-2"
                  onClick={expandAll}
                >
                  Expand pages
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-md text-[10px] px-2"
                  onClick={collapseExpand}
                >
                  Collapse all
                </Button>
              </div>
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {pages.map((page, pageIndex) => {
              const hasChildren = page.children && page.children.length > 0;
              const isExpanded = expandedPages.has(page.id);
              return (
                <div key={page.id}>
                  <div className="flex items-center gap-1 rounded px-1 py-1 hover:bg-muted/50">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(page.id);
                        }}
                        className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3" />
                        ) : (
                          <ChevronRight className="size-3" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handlePageClick(page.id, pageIndex, e)}
                      title="Click to toggle. Shift-click another page to select the range."
                      className="flex items-center gap-2 flex-1 text-sm text-left rounded-md min-h-9"
                    >
                      <Checkbox checked={selectedPages.has(page.id)} />
                      <span className="truncate">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1.5">
                          Page
                        </span>
                        {page.name}
                      </span>
                    </button>
                  </div>
                  {hasChildren && isExpanded && (
                    <div className="ml-5 border-l border-border/40 pl-2 space-y-0.5">
                      {page.children!.map((frame, frameIndex) => (
                        <button
                          key={frame.id}
                          type="button"
                          onClick={(e) =>
                            handleFrameClick(
                              frame.id,
                              page.id,
                              frameIndex,
                              page.children!,
                              e
                            )
                          }
                          title="Click to toggle. Shift-click another frame on this page for a range."
                          className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50 w-full text-left text-sm min-h-9"
                        >
                          <Checkbox checked={selectedFrames.has(frame.id)} />
                          <span className="truncate">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1.5">
                              Frame
                            </span>
                            {frame.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                            {frame.type.toLowerCase()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-lg text-xs"
                  onClick={selectAll}
                >
                  Select all
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-lg text-xs"
                  onClick={clearAll}
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
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 btn-gradient rounded-lg text-xs"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="size-3 animate-spin" /> : "Save scope"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No pages found in this file.</p>
      )}
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-border"
      }`}
    >
      {checked && <Check className="size-3" />}
    </div>
  );
}
