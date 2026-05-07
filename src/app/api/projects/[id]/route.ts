import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-guards";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  archived: z.boolean().optional(),
  figmaAccessToken: z.string().nullable().optional(),
});

function toProjectResponse(
  project: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    archived: boolean;
    figmaAccessToken: string | null;
    files: Array<{
      id: string;
      name: string;
      fileKey: string;
      url: string;
      version: string | null;
      lastSyncedAt: Date | null;
      lastError: string | null;
      includedPages: string[];
      includedFrames: string[];
      lastSyncFigmaCommentTotal: number | null;
      lastSyncImportedCount: number | null;
      lastSyncSkippedScopeCount: number | null;
      _count?: { comments: number };
    }>;
    rounds?: Array<{
      id: string;
      name: string | null;
      syncedAt: Date;
      commentCount: number;
    }>;
  }
) {
  return {
    ...project,
    hasProjectFigmaToken: Boolean(project.figmaAccessToken),
    figmaAccessToken: null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      files: {
        include: {
          _count: { select: { comments: true } },
        },
      },
      rounds: {
        orderBy: { syncedAt: "desc" },
        take: 5,
        select: { id: true, name: true, syncedAt: true, commentCount: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(toProjectResponse(project));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const project = await prisma.project.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(toProjectResponse({ ...project, files: [] }));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.job.deleteMany({ where: { projectId: id } });
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
