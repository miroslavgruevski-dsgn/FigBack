import { NextRequest, NextResponse } from "next/server";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { executeOnePendingJob } from "@/lib/jobs/execute-one-pending-job";

/** Full sync + classify + cluster can exceed 60s; Vercel caps at plan max (often 300s). */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const cronAuth = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronAuth && !isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected", code: "csrf_rejected" }, { status: 403 });
  }

  if (!cronAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { allowed } = checkRateLimit(`jobs_run:${session.user.id}`);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded", code: "rate_limited" }, { status: 429 });
    }
  }

  let projectId: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.projectId === "string" && body.projectId.trim().length > 0) {
      projectId = body.projectId.trim();
    }
  } catch {
    // empty body is fine for backward compatibility
  }

  const result = await executeOnePendingJob(projectId);
  return NextResponse.json(result.body, { status: result.httpStatus });
}
