import { prisma } from "@/lib/db";
import { getFileComments, getFile, getCommentReactions } from "./client";
import { mapComment } from "./map-comments";
import { getFigmaToken } from "./token";
import type { SyncMode, FigmaReaction, GroupedReaction } from "@/types/figma";

export function buildFigmaDeepLink(fileKey: string, nodeId: string | null): string | null {
  if (!nodeId) return null;
  return `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(nodeId)}`;
}

export async function syncProject(projectId: string, mode: SyncMode) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { files: true },
  });

  const token = await getFigmaToken(projectId);
  const results = { newComments: 0, resolvedComments: 0, errors: [] as string[] };

  for (const file of project.files) {
    try {
      await syncFile(file.id, file.fileKey, token, mode);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.errors.push(`${file.name}: ${message}`);

      await prisma.figmaFile.update({
        where: { id: file.id },
        data: { lastError: message },
      });
    }
  }

  return results;
}

function groupReactions(raw: FigmaReaction[]): GroupedReaction[] {
  const map = new Map<string, { count: number; users: string[] }>();
  for (const r of raw) {
    const existing = map.get(r.emoji);
    if (existing) {
      existing.count++;
      if (!existing.users.includes(r.user.handle)) existing.users.push(r.user.handle);
    } else {
      map.set(r.emoji, { count: 1, users: [r.user.handle] });
    }
  }
  return Array.from(map.entries()).map(([emoji, data]) => ({ emoji, ...data }));
}

async function syncFile(
  fileId: string,
  fileKey: string,
  token: string,
  mode: SyncMode
) {
  const commentsResponse = await getFileComments(fileKey, token);
  const figmaComments = commentsResponse.comments;

  let fileTree = null;
  if (mode === "full") {
    const fileData = await getFile(fileKey, token);
    fileTree = fileData.document;

    await prisma.figmaFile.update({
      where: { id: fileId },
      data: {
        name: fileData.name,
        version: fileData.version,
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });
  } else {
    await prisma.figmaFile.update({
      where: { id: fileId },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
  }

  for (const fc of figmaComments) {
    const mapped = fileTree
      ? mapComment(fc, fileTree)
      : {
          nodeId: fc.client_meta?.node_id ?? null,
          frameId: null,
          pageId: null,
          frameName: null,
          pageName: null,
          pinX: fc.client_meta?.node_offset?.x ?? fc.client_meta?.x ?? null,
          pinY: fc.client_meta?.node_offset?.y ?? fc.client_meta?.y ?? null,
          regionW: null,
          regionH: null,
          mapConfidence: fc.client_meta?.node_id ? 0.5 : 0,
        };

    await prisma.comment.upsert({
      where: { id: fc.id },
      create: {
        id: fc.id,
        fileId,
        message: fc.message,
        authorId: fc.user.id,
        authorName: fc.user.handle,
        authorImg: fc.user.img_url,
        parentId: fc.parent_id ?? null,
        createdAt: new Date(fc.created_at),
        resolvedAt: fc.resolved_at ? new Date(fc.resolved_at) : null,
        clientMeta: JSON.parse(JSON.stringify(fc.client_meta ?? {})),
        ...mapped,
      },
      update: {
        message: fc.message,
        resolvedAt: fc.resolved_at ? new Date(fc.resolved_at) : null,
        ...mapped,
      },
    });
  }

  // Fetch reactions for root comments only (replies rarely get reactions)
  const rootComments = figmaComments.filter((fc) => !fc.parent_id);
  for (const fc of rootComments) {
    try {
      const res = await getCommentReactions(fileKey, fc.id, token);
      const grouped = groupReactions(res.reactions);
      await prisma.comment.update({
        where: { id: fc.id },
        data: { reactions: grouped as unknown as import("@prisma/client").Prisma.InputJsonValue },
      });
    } catch {
      // non-critical — skip if reactions endpoint fails
    }
  }
}
