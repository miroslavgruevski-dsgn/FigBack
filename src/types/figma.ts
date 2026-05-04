export interface FigmaUser {
  id: string;
  handle: string;
  img_url: string;
}

export interface FigmaClientMeta {
  node_id?: string;
  node_offset?: { x: number; y: number };
  x?: number;
  y?: number;
}

export interface FigmaComment {
  id: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
  user: FigmaUser;
  parent_id?: string;
  client_meta?: FigmaClientMeta;
  order_id?: string;
}

export interface FigmaCommentsResponse {
  comments: FigmaComment[];
}

export interface FigmaFileResponse {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaNode;
}

export interface FigmaFileNodesResponse {
  name: string;
  lastModified: string;
  version: string;
  nodes: Record<string, { document: FigmaNode } | null>;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FigmaReaction {
  user: FigmaUser;
  emoji: string;
  created_at: string;
}

export interface FigmaReactionsResponse {
  reactions: FigmaReaction[];
}

export interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface FigmaImageResponse {
  err: string | null;
  images: Record<string, string | null>;
}

export type SyncMode = "watch" | "full";
