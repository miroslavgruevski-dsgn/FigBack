"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function EditableTitle({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setValue(name);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) throw new Error();

      toast.success("Project renamed");
      router.refresh();
      setEditing(false);
    } catch {
      toast.error("Failed to rename");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditing(false);
              setValue(name);
            }
          }}
          className="font-heading text-2xl font-semibold bg-transparent border-b-2 border-primary outline-none px-0 py-0 w-full max-w-md"
          disabled={saving}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-primary hover:text-primary/80 p-1"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setValue(name);
          }}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h1 className="font-heading text-2xl font-semibold">{name}</h1>
      <button
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1"
        aria-label="Rename project"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
