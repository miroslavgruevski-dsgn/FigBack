"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  CheckCircle2,
  Circle,
  Loader2,
  ImageOff,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";
import { formatFramePageLine } from "@/lib/digest/display-labels";
import type { Priority, IssueStatus } from "@/types/digest";

function normalizedSummaryLine(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

interface ReactionData {
  emoji: string;
  count: number;
  users: string[];
}

interface CommentData {
  authorName: string;
  authorImg?: string | null;
  message: string;
  createdAt: string;
  reactions?: ReactionData[];
  replies?: {
    authorName: string;
    authorImg?: string | null;
    message: string;
    createdAt: string;
    reactions?: ReactionData[];
  }[];
}

const EMOJI_MAP: Record<string, string> = {
  ":heart:": "❤️",
  ":+1:": "👍",
  ":-1:": "👎",
  ":eyes:": "👀",
  ":fire:": "🔥",
  ":tada:": "🎉",
  ":clap:": "👏",
  ":100:": "💯",
  ":thinking_face:": "🤔",
  ":raised_hands:": "🙌",
  ":star:": "⭐",
  ":rocket:": "🚀",
  ":white_check_mark:": "✅",
  ":warning:": "⚠️",
  ":x:": "❌",
  ":pray:": "🙏",
  ":muscle:": "💪",
  ":sparkles:": "✨",
  ":thumbsup:": "👍",
  ":thumbsdown:": "👎",
};

function shortcodeToEmoji(code: string): string {
  return EMOJI_MAP[code.replace(/::skin-tone-\d:/, "")] ?? code.replace(/:/g, "");
}

function ReactionPills({ reactions }: { reactions: ReactionData[] }) {
  if (!reactions.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r) => (
        <span
          key={r.emoji}
          className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px]"
          title={r.users.join(", ")}
        >
          <span>{shortcodeToEmoji(r.emoji)}</span>
          {r.count > 1 && <span className="text-muted-foreground">{r.count}</span>}
        </span>
      ))}
    </div>
  );
}

interface IssueCardProps {
  clusterId?: string;
  title: string;
  summary: string;
  frameName: string;
  pageName?: string;
  status: IssueStatus;
  priority?: Priority;
  effortEstimate?: string | null;
  figmaDeepLink?: string | null;
  suggestedAction?: string | null;
  thumbnailUrl?: string | null;
  comments: CommentData[];
}

const STATUS_CYCLE: IssueStatus[] = ["open", "in_progress", "done"];
const STATUS_LABELS: Record<string, string> = {
  "open": "Open",
  "in_progress": "In Progress",
  "done": "Done",
};

export function IssueCard({
  clusterId,
  title,
  summary,
  frameName,
  pageName,
  status: initialStatus,
  priority,
  figmaDeepLink,
  suggestedAction,
  thumbnailUrl,
  comments,
}: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<IssueStatus>(initialStatus);
  const [updating, setUpdating] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxOpen, closeLightbox]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  async function cycleStatus() {
    if (!clusterId || updating) return;
    const currentIdx = STATUS_CYCLE.indexOf(status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    setUpdating(true);
    try {
      const res = await fetch(`/api/issues/${clusterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) setStatus(nextStatus);
    } catch { /* ignore */ }
    setUpdating(false);
  }

  return (
    <div className={`glass rounded-lg p-5 space-y-3 hover-lift ${status === "done" ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {priority && <PriorityBadge priority={priority} />}
          {clusterId ? (
            <button
              onClick={cycleStatus}
              disabled={updating}
              className="inline-flex items-center gap-1 text-xs transition-colors hover:opacity-80"
              title={`Click to change status (${STATUS_LABELS[status]})`}
            >
              {updating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : status === "done" ? (
                <CheckCircle2 className="size-3 text-green-500" />
              ) : (
                <Circle className="size-3" />
              )}
              <StatusBadge status={status} />
            </button>
          ) : (
            <StatusBadge status={status} />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {formatFramePageLine(frameName, pageName)}
        </p>
      </div>

      <div className="flex gap-4">
        {thumbnailUrl ? (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="shrink-0 hidden sm:block relative w-28 aspect-[4/3]"
            aria-label={`View larger preview of ${frameName}`}
          >
            <Image
              src={thumbnailUrl}
              alt={`Figma frame: ${frameName}`}
              fill
              sizes="112px"
              className="rounded-md object-cover border border-border/50 hover:opacity-80 transition-opacity"
            />
          </button>
        ) : (
          <div
            className="shrink-0 hidden sm:flex flex-col items-center justify-center w-[4.5rem] aspect-[4/3] rounded-md border border-dashed border-border/50 bg-muted/20 text-muted-foreground"
            aria-hidden
          >
            <ImageOff className="size-5 opacity-50" />
            <span className="text-[9px] mt-0.5 px-0.5 text-center leading-tight">No preview</span>
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          {thumbnailUrl ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="sm:hidden w-full mb-2 relative aspect-[16/9]"
              aria-label={`View larger preview of ${frameName}`}
            >
              <Image
                src={thumbnailUrl}
                alt={`Figma frame: ${frameName}`}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="rounded-md object-cover border border-border/50"
              />
            </button>
          ) : (
            <div className="sm:hidden flex items-center gap-2 mb-2 py-2 px-3 rounded-md border border-dashed border-border/60 bg-muted/20 text-muted-foreground text-xs">
              <ImageOff className="size-4 shrink-0 opacity-70" />
              <span>No frame preview (pin node may be missing in the file)</span>
            </div>
          )}
          <h3 className="font-heading text-base font-semibold leading-snug">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
        </div>
      </div>

      {suggestedAction &&
        normalizedSummaryLine(suggestedAction) !== normalizedSummaryLine(summary) && (
        <div className="glass-tint rounded-md px-3 py-2.5 flex gap-2">
          <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/90">{suggestedAction}</p>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {figmaDeepLink && (
          <a
            href={figmaDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3" />
            Open in Figma
          </a>
        )}
      </div>

      {comments.length > 0 && (
        <div className="border-t border-border/50 pt-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronUp className="size-3.5 transition-transform duration-200" />
            ) : (
              <ChevronDown className="size-3.5 transition-transform duration-200" />
            )}
            {expanded
              ? "Hide comments"
              : `Show ${comments.length} team comment${comments.length !== 1 ? "s" : ""}`}
          </button>

          <div className="expand-grid" data-expanded={expanded}>
            <div>
              <div className="mt-2.5 space-y-2">
                {comments.map((c, i) => (
                  <div key={i}>
                    <div className="flex gap-2">
                      <Avatar className="size-5 mt-0.5 shrink-0">
                        <AvatarImage src={c.authorImg ?? undefined} alt={c.authorName} />
                        <AvatarFallback className="text-[10px]">
                          {c.authorName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs">
                          <span className="font-medium">{c.authorName}</span>
                          <span className="text-muted-foreground ml-1">
                            {new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-3">{c.message}</p>
                        {c.reactions && c.reactions.length > 0 && (
                          <ReactionPills reactions={c.reactions} />
                        )}
                      </div>
                    </div>
                    {c.replies && c.replies.length > 0 && (
                      <div className="ml-7 mt-1.5 space-y-1.5 border-l-2 border-border/40 pl-3">
                        {c.replies.map((r, ri) => (
                          <div key={ri} className="flex gap-2">
                            <Avatar className="size-4 mt-0.5 shrink-0">
                              <AvatarImage src={r.authorImg ?? undefined} alt={r.authorName} />
                              <AvatarFallback className="text-[8px]">
                                {r.authorName[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-[11px]">
                                <span className="font-medium">{r.authorName}</span>
                                <span className="text-muted-foreground ml-1">
                                  {new Date(r.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">{r.message}</p>
                              {r.reactions && r.reactions.length > 0 && (
                                <ReactionPills reactions={r.reactions} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mounted &&
        lightboxOpen &&
        thumbnailUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col text-white"
            role="dialog"
            aria-modal="true"
            aria-label={`Full frame preview: ${title}`}
          >
            <button
              type="button"
              className="absolute inset-0 z-0 bg-black/92 backdrop-blur-sm"
              aria-label="Close preview"
              onClick={closeLightbox}
            />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col pointer-events-none">
              <div className="pointer-events-auto flex shrink-0 items-start justify-end gap-2 p-3 sm:p-4">
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="rounded-full bg-white/15 p-2.5 text-white shadow-lg ring-1 ring-white/20 transition hover:bg-white/25 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/80"
                  aria-label="Close"
                >
                  <X className="size-5" strokeWidth={2.5} />
                </button>
              </div>

              <div className="pointer-events-auto shrink-0 space-y-1 px-4 pb-2 text-center sm:px-8">
                <p className="text-base font-semibold leading-snug sm:text-lg">{title}</p>
                <p className="text-xs text-white/75 sm:text-sm">
                  {formatFramePageLine(frameName, pageName)}
                </p>
                {comments[0] && (
                  <p className="mx-auto max-w-2xl pt-1 text-xs leading-relaxed text-white/85 sm:text-sm">
                    <span className="text-white/60">Comment · </span>
                    <span className="font-medium text-white/95">{comments[0].authorName}</span>
                    <span className="text-white/50"> · </span>
                    <span className="line-clamp-3">{comments[0].message}</span>
                  </p>
                )}
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-2 pt-1 sm:px-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl}
                  alt={`Figma frame: ${frameName}`}
                  className="pointer-events-auto max-h-[min(calc(100vh-14rem),900px)] w-auto max-w-[min(96vw,1200px)] rounded-lg object-contain shadow-2xl ring-1 ring-white/10"
                />
              </div>

              {figmaDeepLink && (
                <div className="pointer-events-auto flex shrink-0 justify-center px-4 pb-6 pt-1">
                  <a
                    href={figmaDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/20"
                  >
                    <ExternalLink className="size-4" />
                    Open pin in Figma
                  </a>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
