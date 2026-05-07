import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { createShareToken } from "@/lib/integrations/share-link";
import { requireApiSession } from "@/lib/api-guards";

const shareSchema = z.object({
  projectId: z.string().min(1),
  roundId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const secret = process.env.IMAGE_SIGN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const token = createShareToken(parsed.data, secret);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const shareUrl = `${baseUrl}/share/${token}`;

  return NextResponse.json({ shareUrl, token });
}
