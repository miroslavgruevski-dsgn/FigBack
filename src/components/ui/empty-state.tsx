import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="glass flex flex-col items-center rounded-lg px-5 py-12 sm:px-6 sm:py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-7 text-primary" />
      </div>
      <h2 className="mt-5 font-heading text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
