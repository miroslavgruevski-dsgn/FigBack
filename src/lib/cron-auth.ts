import type { NextRequest } from "next/server";

/** Matches `/api/cron/process-jobs`: Vercel cron header, bearer secret, or query secret. */
export function isCronAuthorized(req: NextRequest): boolean {
  const q = req.nextUrl.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron") === "1";
  return (
    vercelCron ||
    (Boolean(process.env.CRON_SECRET) && q === process.env.CRON_SECRET) ||
    (Boolean(process.env.CRON_SECRET) && authHeader === `Bearer ${process.env.CRON_SECRET}`)
  );
}
