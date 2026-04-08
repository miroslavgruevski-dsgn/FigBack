import { Skeleton } from "@/components/ui/skeleton";

export default function DigestLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Skeleton className="h-4 w-24 rounded-lg" />
      <Skeleton className="mt-6 h-8 w-48 rounded-lg" />

      <div className="glass mt-8 rounded-lg p-6">
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>

      <div className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-lg p-5">
            <div className="flex gap-4">
              <Skeleton className="size-16 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
