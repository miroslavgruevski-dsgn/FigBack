import type {
  FigmaCommentsResponse,
  FigmaFileNodesResponse,
  FigmaFileResponse,
  FigmaImageResponse,
  FigmaNode,
  FigmaReactionsResponse,
} from "@/types/figma";
import { FigmaApiError } from "@/lib/errors";

const FIGMA_API = "https://api.figma.com/v1";
const RATE_LIMIT_DELAY = 2000;

let lastRequestTime = 0;

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY - elapsed));
  }
  lastRequestTime = Date.now();
}

async function figmaFetch<T>(
  path: string,
  token: string,
  retries = 3
): Promise<T> {
  await throttle();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${FIGMA_API}${path}`, {
      headers: { "X-Figma-Token": token },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) {
      throw new FigmaApiError(
        `Figma API error: ${res.status} ${res.statusText}`,
        res.status
      );
    }

    return res.json() as Promise<T>;
  }

  throw new FigmaApiError("Figma API rate limit exceeded after retries", 429);
}

export async function getFileComments(
  fileKey: string,
  token: string
): Promise<FigmaCommentsResponse> {
  return figmaFetch<FigmaCommentsResponse>(
    `/files/${fileKey}/comments`,
    token
  );
}

export function getFileTreeDepth(): number {
  const raw = process.env.FIGMA_FILE_TREE_DEPTH;
  if (raw === undefined || raw === "") return 8;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.min(n, 50);
}

export async function getFile(
  fileKey: string,
  token: string
): Promise<FigmaFileResponse> {
  const depth = getFileTreeDepth();
  return figmaFetch<FigmaFileResponse>(
    `/files/${fileKey}?depth=${depth}`,
    token
  );
}

const FILE_NODES_BATCH = 50;

export async function getFileNodes(
  fileKey: string,
  nodeIds: string[],
  token: string
): Promise<Record<string, { document: FigmaNode } | undefined>> {
  if (nodeIds.length === 0) return {};
  const out: Record<string, { document: FigmaNode } | undefined> = {};
  for (let i = 0; i < nodeIds.length; i += FILE_NODES_BATCH) {
    const batch = nodeIds.slice(i, i + FILE_NODES_BATCH);
    const qs = batch.map((id) => encodeURIComponent(id)).join(",");
    const data = await figmaFetch<FigmaFileNodesResponse>(
      `/files/${fileKey}/nodes?ids=${qs}&depth=2`,
      token
    );
    for (const [key, entry] of Object.entries(data.nodes ?? {})) {
      if (entry?.document) {
        out[key] = { document: entry.document };
      }
    }
  }
  return out;
}

export async function getFileImages(
  fileKey: string,
  nodeIds: string[],
  token: string,
  scale = 2
): Promise<FigmaImageResponse> {
  const ids = nodeIds.join(",");
  return figmaFetch<FigmaImageResponse>(
    `/images/${fileKey}?ids=${encodeURIComponent(ids)}&scale=${scale}&format=png`,
    token
  );
}

export async function getCommentReactions(
  fileKey: string,
  commentId: string,
  token: string
): Promise<FigmaReactionsResponse> {
  return figmaFetch<FigmaReactionsResponse>(
    `/files/${fileKey}/comments/${commentId}/reactions`,
    token
  );
}

export async function verifyToken(
  token: string
): Promise<{ valid: boolean; user?: { handle: string; img_url: string } }> {
  try {
    const res = await fetch(`${FIGMA_API}/me`, {
      headers: { "X-Figma-Token": token },
    });
    if (!res.ok) return { valid: false };
    const data = await res.json();
    return { valid: true, user: { handle: data.handle, img_url: data.img_url } };
  } catch {
    return { valid: false };
  }
}

export function extractFileKey(url: string): string | null {
  const patterns = [
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
