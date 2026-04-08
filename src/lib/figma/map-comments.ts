import type { FigmaComment, FigmaNode } from "@/types/figma";

interface MappedComment {
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
  const frame =
    path.find(
      (n) =>
        n.type === "FRAME" ||
        n.type === "COMPONENT" ||
        n.type === "COMPONENT_SET"
    ) ?? null;

  return {
    nodeId,
    frameId: frame?.id ?? null,
    pageId: page?.id ?? null,
    frameName: frame?.name ?? null,
    pageName: page?.name ?? null,
    pinX,
    pinY,
    regionW: null,
    regionH: null,
    mapConfidence: 1,
  };
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
