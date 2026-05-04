import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "dismissed"]).optional(),
  assignee: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  effortEstimate: z.enum(["small", "medium", "large"]).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "done") {
    data.resolvedAt = new Date();
  }

  const cluster = await prisma.issueCluster.update({
    where: { id },
    data,
  });

  return NextResponse.json(cluster);
}
