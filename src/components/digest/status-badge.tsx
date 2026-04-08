import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IssueStatus } from "@/types/digest";

const config: Record<IssueStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-status-open/15 text-status-open border-status-open/25" },
  in_progress: { label: "In Progress", className: "bg-primary/15 text-primary border-primary/25" },
  done: { label: "Done", className: "bg-status-done/15 text-status-done border-status-done/25" },
  dismissed: { label: "Dismissed", className: "bg-status-dismissed/15 text-status-dismissed border-status-dismissed/25" },
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  const c = config[status];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium animate-in fade-in-0 zoom-in-95 duration-200", c.className)}>
      {c.label}
    </Badge>
  );
}
