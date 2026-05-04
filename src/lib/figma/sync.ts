import { prisma } from "@/lib/db";
import {
  getCommentReactions,
  getFileComments,
  getFile,
  getFileNodes,
} from "./client";
import {
  applyIncludedSelectionFallback,
  buildNodeIdToNameMap,
  enrichMappedFromNodeDocuments,
  mapComment,
  type MappedComment,
} from "./map-comments";
import { getFigmaToken } from "./token";
import { logger } from "@/lib/logger";
import type { FigmaComment, FigmaReaction, SyncMode } from "@/types/figma";

function reactionsSyncCap(): number {
  const raw = process.env.FIGMA_REACTIONS_SYNC_CAP;
  if (raw === undefined || raw === "") return 80;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 80;
  return Math.min(n, 500);
}

function groupReactionsForStore(
  reactions: FigmaReaction[]
): { emoji: string; count: number; users: string[] }[] {
  const map = new Map<string, { count: number; users: string[] }>();
  for (const r of reactions) {
    const cur = map.get(r.emoji) ?? { count: 0, users: [] };
    cur.count += 1;
    const handle = r.user?.handle ?? "?";
    if (!cur.users.includes(handle)) cur.users.push(handle);
    map.set(r.emoji, cur);
  }
  return [...map.entries()].map(([emoji, v]) => ({
    emoji,
    count: v.count,
    users: v.users,
  }));
}

export function buildFigmaDeepLink(fileKey: string, nodeId: string | null): string | null {
  if (!nodeId) return null;
  return `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(nodeId)}`;
}

export async function syncProject(projectId: string, mode: SyncMode, roundId?: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { files: true },
  });

  if (!project) {
    await prisma.job.deleteMany({ where: { projectId } });
    return { newComments: 0, resolvedComments: 0, errors: [`Project ${projectId} not found`] };
  }

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
      resolvedAt: null,
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

function watchModeMapped(fc: FigmaComment): MappedComment {
  return {
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
}

async function syncFile(
  fileId: string,
  fileKey: string,
  token: string,
  mode: SyncMode
): Promise<void> {
  const dbFile = await prisma.figmaFile.findUniqueOrThrow({
    where: { id: fileId },
    select: { includedPages: true, includedFrames: true },
  });
  const includedPages = dbFile.includedPages ?? [];
  const includedFrames = dbFile.includedFrames ?? [];
  const pageFilter = new Set(includedPages);
  const frameFilter = new Set(includedFrames);
  const hasPageFilter = pageFilter.size > 0;
  const hasFrameFilter = frameFilter.size > 0;

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

  const nameMap = fileTree ? buildNodeIdToNameMap(fileTree) : new Map<string, string>();

  const rows: { fc: FigmaComment; mapped: MappedComment }[] = [];

  for (const fc of figmaComments) {
    let mapped: MappedComment = fileTree ? mapComment(fc, fileTree) : watchModeMapped(fc);
    mapped = applyIncludedSelectionFallback(mapped, includedPages, includedFrames, nameMap);
    rows.push({ fc, mapped });
  }

  const needNodeIds = [
    ...new Set(
      rows
        .filter((r) => r.mapped.nodeId && (!r.mapped.frameName || !r.mapped.pageName))
        .map((r) => r.mapped.nodeId as string)
    ),
  ];

  if (needNodeIds.length > 0) {
    const nodes = await getFileNodes(fileKey, needNodeIds, token);
    for (const row of rows) {
      row.mapped = enrichMappedFromNodeDocuments(row.mapped, nodes);
      row.mapped = applyIncludedSelectionFallback(row.mapped, includedPages, includedFrames, nameMap);
    }
  }

  const upsertOps = [];

  for (const { fc, mapped } of rows) {
    if (hasPageFilter && mapped.pageId && !pageFilter.has(mapped.pageId)) {
      continue;
    }

    if (hasFrameFilter && mapped.frameId && !frameFilter.has(mapped.frameId)) {
      continue;
    }

    upsertOps.push(
      prisma.comment.upsert({
        where: { id: fc.id },
        create: {
          id: fc.id,
          fileId,
          message: fc.message,
          authorId: fc.user.id,
          authorName: fc.user.handle,
          authorImg: fc.user.img_url,
          parentId: fc.parent_id || null,
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
      })
    );
  }

  const BATCH = 200;
  for (let i = 0; i < upsertOps.length; i += BATCH) {
    await prisma.$transaction(upsertOps.slice(i, i + BATCH));
  }

  if (mode === "full") {
    const cap = reactionsSyncCap();
    const roots = await prisma.comment.findMany({
      where: { fileId, parentId: null },
      select: { id: true },
    });
    const toFetch = cap === 0 ? [] : roots.slice(0, cap);
    if (roots.length > toFetch.length) {
      logger.warn("Reactions fetch capped for job time budget", {
        fileId,
        total: roots.length,
        cap,
      });
    }
    for (const { id } of toFetch) {
      try {
        const res = await getCommentReactions(fileKey, id, token);
        const grouped = groupReactionsForStore(res.reactions ?? []);
        await prisma.comment.update({
          where: { id },
          data: { reactions: grouped },
        });
      } catch {
        /* ignore per-comment reaction failures */
      }
    }
  }
}
