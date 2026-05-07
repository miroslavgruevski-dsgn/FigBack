import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SummaryCardProps {
  summary: string;
  topIssues: string[];
  sentiment: "positive" | "mixed" | "negative";
  keyThemes: string[];
  source?: "llm" | "heuristic" | null;
}

export function SummaryCard({ summary, topIssues, keyThemes, source }: SummaryCardProps) {
  const extraBits: string[] = [];
  if (topIssues.length > 0) {
    const highlights = topIssues
      .slice(0, 2)
      .map((item) => item.replace(/^\[[^\]]+\]\s*[^:]+:\s*/i, "").trim())
      .filter(Boolean);
    if (highlights.length > 0) {
      extraBits.push(`Highlights: ${highlights.join(" ")}`);
    }
  }
  if (keyThemes.length > 0) {
    extraBits.push(`Themes: ${keyThemes.slice(0, 3).join(", ")}.`);
  }
  const expandedSummary = [summary.trim(), ...extraBits].join(" ");

  return (
    <div className="glass-tint rounded-lg p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Sparkles className="size-5 text-primary" />
          At a Glance
        </h2>
        {source === "heuristic" && (
          <Badge variant="secondary" className="text-[10px] rounded-full px-2 py-0.5">
            fallback mode
          </Badge>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{expandedSummary}</p>
    </div>
  );
}
