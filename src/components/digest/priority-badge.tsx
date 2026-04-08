import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority } from "@/types/digest";

const config: Record<Priority, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-priority-critical/15 text-priority-critical border-priority-critical/25" },
  high: { label: "High", className: "bg-priority-high/15 text-priority-high border-priority-high/25" },
  medium: { label: "Medium", className: "bg-priority-medium/15 text-priority-medium border-priority-medium/25" },
  low: { label: "Low", className: "bg-priority-low/15 text-priority-low border-priority-low/25" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const c = config[priority];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium animate-in fade-in-0 zoom-in-95 duration-200", c.className)}>
      {c.label}
    </Badge>
  );
}
