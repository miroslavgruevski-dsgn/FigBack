import type { Prisma } from "@prisma/client";

export type IssueReply = {
  authorName: string;
  authorImg?: string | null;
  message: string;
  createdAt: string;
  reactions?: { emoji: string; count: number; users: string[] }[];
};

type StoredThreadEntry = {
  message: string;
  authorName: string;
  authorImg?: string | null;
  createdAt: string | Date;
};

export function commentThreadToReplies(
  thread: Prisma.JsonValue | null | undefined
): IssueReply[] | undefined {
  if (!thread || !Array.isArray(thread)) return undefined;
  const list = thread as StoredThreadEntry[];
  if (list.length === 0) return undefined;
  return list.map((r) => ({
    authorName: r.authorName,
    authorImg: r.authorImg,
    message: r.message,
    createdAt:
      typeof r.createdAt === "string"
        ? r.createdAt
        : new Date(r.createdAt).toISOString(),
    reactions: [],
  }));
}
