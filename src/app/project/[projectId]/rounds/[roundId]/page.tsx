import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; roundId: string }>;
}) {
  const { roundId } = await params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to rounds
      </Link>

      <h1 className="mt-6 font-heading text-2xl font-semibold">Round {roundId.slice(0, 8)}</h1>

      <div className="glass mt-8 rounded-lg p-5">
        <p className="text-sm text-muted-foreground">
          Round detail view coming in Phase 5.
        </p>
      </div>
    </div>
  );
}
