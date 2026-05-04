/** Client-side: drain the job queue by repeatedly calling POST /api/jobs/run. */

const POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 15 * 60 * 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatJobStage(type: string | null | undefined): string {
  switch (type) {
    case "sync_full":
    case "sync_watch":
      return "Syncing comments...";
    case "export_images":
      return "Exporting images...";
    case "classify":
      return "Classifying...";
    case "cluster":
      return "Clustering...";
    default:
      return "Processing...";
  }
}

export async function runJobQueueUntilIdle(options?: {
  onProgress?: (label: string) => void;
  maxWaitMs?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const maxWait = options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const res = await fetch("/api/jobs/run", { method: "POST" });
    const data = (await res.json()) as {
      message?: string;
      status?: string;
      hasMore?: boolean;
      nextType?: string | null;
      runningType?: string;
      error?: string;
    };

    if (data.status === "failed" || (res.status >= 400 && data.error)) {
      return { ok: false, error: data.error ?? "Job failed" };
    }

    if (data.message === "all_done") {
      return { ok: true };
    }

    if (data.message === "jobs_running") {
      options?.onProgress?.(formatJobStage(data.runningType));
      await delay(POLL_INTERVAL_MS);
      continue;
    }

    options?.onProgress?.(formatJobStage(data.nextType));

    if (!data.hasMore) {
      return { ok: true };
    }

    await delay(POLL_INTERVAL_MS);
  }

  return { ok: false, error: "Timed out waiting for background jobs" };
}
