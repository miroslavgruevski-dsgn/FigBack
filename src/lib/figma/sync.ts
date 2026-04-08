import { prisma } from "@/lib/db";
import { getFileComments, getFile, getCommentReactions } from "./client";
import { mapComment } from "./map-comments";
import { getFigmaToken } from "./token";
import type { SyncMode, FigmaReaction, GroupedReaction } from "@/types/figma";

export function buildFigmaDeepLink(fileKey: string, nodeId: string | null): string | null {
  if (!nodeId) return null;
  return `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(nodeId)}`;
}

export async function syncProject(projectId: string, mode: SyncMode, roundId?: string) {
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

  if (roundId) {
    await createReviewCards(projectId, roundId);
  }

  return results;
}

async function createReviewCards(projectId: string, roundId: string) {
  const rootComments = await prisma.comment.findMany({
    where: {
      file: { projectId },
      parentId: null,
      processed: false,
    },
    include: {
      file: { select: { fileKey: true } },
    },
  });

  const replyMap = new Map<string, { message: string; authorName: string; authorImg: string | null; createdAt: Date }[]>();
  if (rootComments.length > 0) {
    const replies = await prisma.comment.findMany({
      where: {
        parentId: { in: rootComments.map((c) => c.id) },
      },
      select: { parentId: true, message: true, authorName: true, authorImg: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    for (const r of replies) {
      if (!r.parentId) continue;
      const list = replyMap.get(r.parentId) ?? [];
      list.push({ message: r.message, authorName: r.authorName, authorImg: r.authorImg, createdAt: r.createdAt });
      replyMap.set(r.parentId, list);
    }
  }

  let created = 0;
  for (const comment of rootComments) {
    const thread = replyMap.get(comment.id) ?? [];
    await prisma.reviewCard.create({
      data: {
        commentId: comment.id,
        roundId,
        commentThread: thread as unknown as import("@prisma/client").Prisma.InputJsonValue,
        frameName: comment.frameName ?? "Unknown",
        pageName: comment.pageName ?? "Unknown",
        targetNodeName: null,
        targetNodeType: null,
        figmaDeepLink: buildFigmaDeepLink(comment.file.fileKey, comment.nodeId),
      },
    });

    await prisma.comment.update({
      where: { id: comment.id },
      data: { processed: true },
    });
    created++;
  }

  await prisma.reviewRound.update({
    where: { id: roundId },
    data: { commentCount: created },
  });
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
  const dbFile = await prisma.figmaFile.findUniqueOrThrow({
    where: { id: fileId },
    select: { includedPages: true },
  });
  const pageFilter = new Set(dbFile.includedPages);
  const hasPageFilter = pageFilter.size > 0;

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

  const syncedCommentIds: string[] = [];

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

    if (hasPageFilter && mapped.pageId && !pageFilter.has(mapped.pageId)) {
      continue;
    }

    syncedCommentIds.push(fc.id);

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

  const syncedIds = new Set(syncedCommentIds);
  const rootComments = figmaComments.filter(
    (fc) => !fc.parent_id && syncedIds.has(fc.id)
  );
  for (const fc of rootComments) {
    try {
      const res = await getCommentReactions(fileKey, fc.id, token);
      const grouped = groupReactions(res.reactions);
      await prisma.comment.update({
        where: { id: fc.id },
        data: { reactions: grouped as unknown as import("@prisma/client").Prisma.InputJsonValue },
      });
    } catch {
      // non-critical
    }
  }
}
