import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div>
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-64 rounded" />
      </div>

      <div className="mt-8 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="h-3 w-56 rounded" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
