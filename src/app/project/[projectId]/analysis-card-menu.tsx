"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteAnalysisButton } from "./delete-analysis-button";

export function AnalysisCardMenu({
  projectId,
  roundId,
  analysisLabel,
}: {
  projectId: string;
  roundId: string;
  analysisLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-muted/70"
            aria-label="Analysis card actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DeleteAnalysisButton
          projectId={projectId}
          roundId={roundId}
          analysisLabel={analysisLabel}
          afterDelete="refresh"
          variant="menu-item"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
