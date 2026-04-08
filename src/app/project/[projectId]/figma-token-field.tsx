"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Key, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function FigmaTokenField({
  projectId,
  defaultValue,
  autoOpen = false,
}: {
  projectId: string;
  defaultValue: string | null;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const hasOverride = !!defaultValue;

  async function saveToken(value: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaAccessToken: value || null }),
      });
      if (res.ok) {
        toast.success("Figma token updated");
      } else {
        toast.error("Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    }
  }

  return (
    <div className={cn(
      "glass rounded-lg p-4 hover-lift transition-colors",
      autoOpen && "border-destructive/50"
    )}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        aria-controls="figma-token-panel"
      >
        <div className="flex items-center gap-2">
          {autoOpen ? (
            <AlertTriangle className="size-3.5 text-destructive" />
          ) : (
            <Key className="size-3.5 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Figma Token</span>
          <span className="text-xs text-muted-foreground">
            {hasOverride ? "Project override" : "Using global token"}
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div id="figma-token-panel" className="mt-3 space-y-1.5">
          {autoOpen && (
            <p className="text-xs text-destructive mb-2">
              Your Figma token has expired or is invalid. Enter a new one to resume syncing.
            </p>
          )}
          <Label htmlFor="project-figma-token" className="text-xs">
            Personal Access Token (optional)
          </Label>
          <Input
            id="project-figma-token"
            type="password"
            placeholder="Leave empty to use global token"
            defaultValue={defaultValue ?? ""}
            className="rounded-lg"
            onBlur={(e) => saveToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Set a project-specific token when this project uses a different Figma account.
          </p>
        </div>
      )}
    </div>
  );
}
