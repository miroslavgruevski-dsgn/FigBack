import type { FigmaComment, FigmaNode } from "@/types/figma";

export interface MappedComment {
  nodeId: string | null;
  frameId: string | null;
  pageId: string | null;
  frameName: string | null;
  pageName: string | null;
  pinX: number | null;
  pinY: number | null;
  regionW: number | null;
  regionH: number | null;
  mapConfidence: number;
}

export function mapComment(
  comment: FigmaComment,
  fileTree: FigmaNode
): MappedComment {
  const meta = comment.client_meta;
  if (!meta) {
    return empty();
  }

  const nodeId = meta.node_id ?? null;
  const pinX = meta.node_offset?.x ?? meta.x ?? null;
  const pinY = meta.node_offset?.y ?? meta.y ?? null;

  if (!nodeId) {
    return { ...empty(), pinX, pinY, mapConfidence: 0.2 };
  }

  const path = findNodePath(fileTree, nodeId);
  if (!path || path.length === 0) {
    return { ...empty(), nodeId, pinX, pinY, mapConfidence: 0.3 };
  }

  const page = path.find((n) => n.type === "CANVAS") ?? null;
  const container = pickDisplayContainer(path);

  return {
    nodeId,
    frameId: container?.id ?? null,
    pageId: page?.id ?? null,
    frameName: container?.name ?? null,
    pageName: page?.name ?? null,
    pinX,
    pinY,
    regionW: null,
    regionH: null,
    mapConfidence: container ? 1 : page ? 0.6 : 0.4,
  };
}

export const DISPLAY_CONTAINER_TYPES = new Set([
  "FRAME",
  "COMPONENT",
  "COMPONENT_SET",
  "SECTION",
]);

function pickDisplayContainer(path: FigmaNode[]): { id: string; name: string } | null {
  let primary: FigmaNode | null = null;
  let groupFallback: FigmaNode | null = null;
  for (const n of path) {
    if (DISPLAY_CONTAINER_TYPES.has(n.type)) {
      primary = n;
    }
    if (n.type === "GROUP") {
      groupFallback = n;
    }
  }
  const chosen = primary ?? groupFallback;
  return chosen ? { id: chosen.id, name: chosen.name } : null;
}

function empty(): MappedComment {
  return {
    nodeId: null,
    frameId: null,
    pageId: null,
    frameName: null,
    pageName: null,
    pinX: null,
    pinY: null,
    regionW: null,
    regionH: null,
    mapConfidence: 0,
  };
}

function findNodePath(
  node: FigmaNode,
  targetId: string,
  path: FigmaNode[] = []
): FigmaNode[] | null {
  const currentPath = [...path, node];
  if (node.id === targetId) return currentPath;
  if (!node.children) return null;

  for (const child of node.children) {
    const result = findNodePath(child, targetId, currentPath);
    if (result) return result;
  }
  return null;
}

export function buildNodeIdToNameMap(tree: FigmaNode): Map<string, string> {
  const m = new Map<string, string>();
  function walk(n: FigmaNode) {
    m.set(n.id, n.name);
    if (n.children) {
      for (const c of n.children) walk(c);
    }
  }
  walk(tree);
  return m;
}

export function applyIncludedSelectionFallback(
  mapped: MappedComment,
  _includedPages: string[],
  _includedFrames: string[],
  idToName: Map<string, string>
): MappedComment {
  const out = { ...mapped };
  if (out.pageId && !out.pageName && idToName.has(out.pageId)) {
    out.pageName = idToName.get(out.pageId) ?? out.pageName;
  }
  if (out.frameId && !out.frameName && idToName.has(out.frameId)) {
    out.frameName = idToName.get(out.frameId) ?? out.frameName;
  }
  return out;
}

type NodesDocMap = Record<string, { document: FigmaNode } | null | undefined>;

export function enrichMappedFromNodeDocuments(
  mapped: MappedComment,
  nodes: NodesDocMap
): MappedComment {
  const nid = mapped.nodeId;
  if (!nid) return mapped;
  const doc = nodes[nid]?.document ?? null;
  if (!doc) return mapped;
  const out = { ...mapped };
  if (!out.frameName && DISPLAY_CONTAINER_TYPES.has(doc.type)) {
    out.frameId = doc.id;
    out.frameName = doc.name;
    out.mapConfidence = Math.max(out.mapConfidence, 0.85);
  }
  return out;
}
