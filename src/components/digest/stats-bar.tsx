import { MessageSquare, Layers, CheckCircle, AlertTriangle } from "lucide-react";

interface StatsBarProps {
  totalComments: number;
  totalClusters: number;
  resolvedClusters: number;
  criticalCount: number;
}

export function StatsBar({ totalComments, totalClusters, resolvedClusters, criticalCount }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat icon={MessageSquare} label="Comments" value={totalComments} />
      <Stat icon={Layers} label="Issues" value={totalClusters} />
      <Stat icon={CheckCircle} label="Resolved" value={resolvedClusters} color="text-status-done" />
      <Stat icon={AlertTriangle} label="Critical" value={criticalCount} color="text-priority-critical" />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="glass rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${color ?? "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 font-heading text-2xl font-semibold">{value}</p>
    </div>
  );
}
