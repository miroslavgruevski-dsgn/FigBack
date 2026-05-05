"use client";

import { MessageSquare, Layers, CheckCircle, AlertTriangle, Timer, EyeOff } from "lucide-react";
import type { ReactNode } from "react";

interface StatsBarProps {
  totalComments: number;
  totalClusters: number;
  resolvedClusters: number;
  criticalCount: number;
  openClusters?: number;
  inProgressClusters?: number;
  dismissedClusters?: number;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

export function StatsBar({
  totalComments,
  totalClusters,
  resolvedClusters,
  criticalCount,
  openClusters = 0,
  inProgressClusters = 0,
  dismissedClusters = 0,
  activeFilter = "all",
  onFilterChange,
}: StatsBarProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={MessageSquare}
          label="Comments in digest"
          value={totalComments}
          active={activeFilter === "all"}
          onClick={onFilterChange ? () => onFilterChange("all") : undefined}
        />
        <Stat
          icon={Layers}
          label="Issues"
          value={totalClusters}
          active={activeFilter === "all"}
          onClick={onFilterChange ? () => onFilterChange("all") : undefined}
        />
        <Stat
          icon={CheckCircle}
          label="Resolved issues"
          value={resolvedClusters}
          color="text-status-done"
          active={activeFilter === "done"}
          onClick={onFilterChange ? () => onFilterChange("done") : undefined}
        />
        <Stat
          icon={AlertTriangle}
          label="Critical issues"
          value={criticalCount}
          color="text-priority-critical"
          active={activeFilter === "critical"}
          onClick={onFilterChange ? () => onFilterChange("critical") : undefined}
        />
      </div>
      {onFilterChange && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label={`All (${totalClusters})`}
            active={activeFilter === "all"}
            onClick={() => onFilterChange("all")}
          />
          <FilterChip
            label={`Open (${openClusters})`}
            active={activeFilter === "open"}
            onClick={() => onFilterChange("open")}
          />
          <FilterChip
            label={`In Progress (${inProgressClusters})`}
            active={activeFilter === "in_progress"}
            onClick={() => onFilterChange("in_progress")}
            icon={<Timer className="size-3.5" />}
          />
          <FilterChip
            label={`Resolved (${resolvedClusters})`}
            active={activeFilter === "done"}
            onClick={() => onFilterChange("done")}
            icon={<CheckCircle className="size-3.5" />}
          />
          <FilterChip
            label={`Dismissed (${dismissedClusters})`}
            active={activeFilter === "dismissed"}
            onClick={() => onFilterChange("dismissed")}
            icon={<EyeOff className="size-3.5" />}
          />
          <FilterChip
            label={`Critical (${criticalCount})`}
            active={activeFilter === "critical"}
            onClick={() => onFilterChange("critical")}
            icon={<AlertTriangle className="size-3.5" />}
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      className={`glass rounded-lg px-4 py-3 text-left ${onClick ? "cursor-pointer transition hover:border-primary/40" : ""} ${active ? "border-primary/50" : ""}`}
      onClick={onClick}
      type={Comp === "button" ? "button" : undefined}
    >
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${color ?? "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 font-heading text-2xl font-semibold">{value}</p>
    </Comp>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
