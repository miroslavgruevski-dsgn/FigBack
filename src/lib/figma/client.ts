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
const DEFAULT_TIMEOUT_MS = 20_000;

let lastRequestTime = 0;

function figmaTimeoutMs(): number {
  const raw = process.env.FIGMA_FETCH_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1_000) return DEFAULT_TIMEOUT_MS;
  return Math.min(parsed, 120_000);
}

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), figmaTimeoutMs());
    let res: Response;
    try {
      res = await fetch(`${FIGMA_API}${path}`, {
        headers: { "X-Figma-Token": token },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort && attempt < retries) {
        continue;
      }
      if (isAbort) {
        throw new FigmaApiError("Figma API timeout", 504);
      }
      throw err;
    }
    clearTimeout(timeout);

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

/**
 * API key for Figma REST: file key or branch key.
 * Branch URLs: use the segment after /branch/ (see Figma REST docs).
 */
export function extractFileKey(url: string): string | null {
  const branch = url.match(
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)\/branch\/([a-zA-Z0-9]+)/i
  );
  if (branch) return branch[2];

  const patterns = [
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
