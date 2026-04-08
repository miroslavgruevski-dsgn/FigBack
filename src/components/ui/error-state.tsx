import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again later.",
  backHref = "/",
  backLabel = "Back to dashboard",
}: ErrorStateProps) {
  return (
    <div className="glass flex flex-col items-center rounded-lg px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-lg bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <h2 className="mt-5 font-heading text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Link href={backHref} className={cn(buttonVariants(), "mt-6 rounded-lg")}>
        {backLabel}
      </Link>
    </div>
  );
}
