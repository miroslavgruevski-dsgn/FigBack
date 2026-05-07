import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { executeOnePendingJob } from "@/lib/jobs/execute-one-pending-job";

/** One job per invocation; cron keeps the queue moving without a browser tab. */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await executeOnePendingJob();
  return NextResponse.json(result.body, { status: result.httpStatus });
}
