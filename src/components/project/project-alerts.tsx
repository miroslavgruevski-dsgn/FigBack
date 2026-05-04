import Link from "next/link";

export type ProjectAlertItem = {
  key: string;
  title: string;
  detail?: string;
  href?: string;
  linkText?: string;
};

export function ProjectAlerts({ alerts }: { alerts: ProjectAlertItem[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="mt-4 space-y-2" role="region" aria-label="Needs attention">
      {alerts.map((a) => (
        <div
          key={a.key}
          className="rounded-lg border border-amber-500/35 bg-amber-500/[0.07] px-3 py-2.5 text-sm"
        >
          <p className="font-medium text-foreground">{a.title}</p>
          {a.detail ? (
            <p className="mt-1 text-xs text-muted-foreground leading-snug">{a.detail}</p>
          ) : null}
          {a.href ? (
            <Link
              href={a.href}
              className="mt-1.5 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              {a.linkText ?? "Open"}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
