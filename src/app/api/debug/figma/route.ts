import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileComments, getFile } from "@/lib/figma/client";
import { getFigmaToken } from "@/lib/figma/token";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { files: { select: { id: true, fileKey: true, name: true, lastError: true, includedPages: true, includedFrames: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const token = await getFigmaToken(projectId);
  const tokenPreview = token ? `${token.slice(0, 6)}...${token.slice(-4)}` : "EMPTY";

  const results = [];

  for (const file of project.files) {
    try {
      const commentsRes = await getFileComments(file.fileKey, token);
      const commentCount = commentsRes.comments?.length ?? 0;
      const sampleComments = commentsRes.comments?.slice(0, 3).map((c) => ({
        id: c.id,
        message: c.message.slice(0, 100),
        user: c.user?.handle,
        hasClientMeta: !!c.client_meta,
        parentId: c.parent_id ?? null,
      })) ?? [];

      const dbComments = await prisma.comment.count({ where: { fileId: file.id } });

      results.push({
        fileKey: file.fileKey,
        fileName: file.name,
        lastError: file.lastError,
        includedPages: file.includedPages,
        includedFrames: file.includedFrames,
        figmaCommentCount: commentCount,
        dbCommentCount: dbComments,
        sampleComments,
      });
    } catch (err) {
      results.push({
        fileKey: file.fileKey,
        fileName: file.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    project: project.name,
    tokenPreview,
    files: results,
  });
}
