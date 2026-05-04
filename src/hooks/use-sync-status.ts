"use client";

import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-json-response";

interface JobStatus {
  id: string;
  type: string;
  status: "pending" | "running" | "done" | "failed";
  error?: string;
}

export function useSyncStatus(jobId: string | null) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!jobId || done) return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/jobs/run`, { method: "POST" });
        if (cancelled) return;
        const data = await parseResponseJson<JobStatus>(res);
        if (!data) return;
        setStatus(data);
        if (data.status === "done" || data.status === "failed") {
          setDone(true);
        }
      } catch {
        if (!cancelled) setDone(true);
      }
    }

    const interval = setInterval(tick, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, done]);

  const polling = !!jobId && !done;

  return { status, polling };
}
