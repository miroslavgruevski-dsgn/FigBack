import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SummaryCardProps {
  summary: string;
  topIssues: string[];
  sentiment: "positive" | "mixed" | "negative";
  keyThemes: string[];
}

const sentimentConfig = {
  positive: { icon: TrendingUp, label: "Positive", className: "text-status-done" },
  mixed: { icon: Minus, label: "Mixed", className: "text-priority-medium" },
  negative: { icon: TrendingDown, label: "Needs attention", className: "text-priority-high" },
};

export function SummaryCard({ summary, topIssues, sentiment, keyThemes }: SummaryCardProps) {
  const s = sentimentConfig[sentiment];

  return (
    <div className="glass-tint rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <h2 className="font-heading text-lg font-semibold">At a Glance</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <s.icon className={`size-4 ${s.className}`} />
          <span className={`text-xs font-medium ${s.className}`}>{s.label}</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>

      {topIssues.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Top Issues
          </h3>
          <ol className="list-decimal list-inside space-y-1">
            {topIssues.map((issue, i) => (
              <li key={i} className="text-sm text-foreground/90">{issue}</li>
            ))}
          </ol>
        </div>
      )}

      {keyThemes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keyThemes.map((theme) => (
            <Badge key={theme} variant="secondary" className="text-xs">
              {theme}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
