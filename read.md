Below is a single, self‑contained Markdown file you can copy at once into a file such as `review-digest-spec.md`. You can paste this entire block as-is into your editor.

***

# ReviewDigest — Figma Review Intelligence Spec

## Goal
Turn messy Figma comments into grouped, visual‑context‑aware issues with clear next actions for your team.

## Target
- Small internal tool, standalone app  
- Uses Figma REST API (no MCP as core)  
- Optional LLM plugin later  

***

## 1. Core workflow

1. User pastes a Figma file URL (e.g. `https://www.figma.com/file/AbCdEf/file-name`).  
2. Backend:  
   - Extracts `file_key`.  
   - Fetches:  
     - comments,  
     - file tree + nodes,  
     - exports frame/node images.  
3. For each comment:  
   - Maps to a frame/node using `client_meta` + file tree.  
   - Generates:  
     - full frame image,  
     - local crop around the pin,  
     - annotated crop (marker / bounding box).  
4. LLM (“review card”) analyzes:  
   - comment text + thread,  
   - frame + node context,  
   - images.  
5. Backend clusters similar comments into issues.  
6. UI shows:  
   - issues by screen / frame,  
   - issues by component,  
   - CSV / Markdown export for the team.  

***

## 2. Data model (simplified)

### File
```ts
type File = {
  id: string;        // Figma file_key
  name: string;
  url: string;
  last_synced_at: Date;
};
```

### Comment
```ts
type Comment = {
  id: string;        // Figma comment.id
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
  parentId: string | null;
  author: {
    id: string;
    name: string;
    email: string;
  };
  clientMeta: Record<string, unknown>; // Figma client_meta (coords, node_id, etc.)
  origin: "figma";
};
```

### CommentTarget
```ts
type CommentTarget = {
  commentId: string;
  nodeId: string;              // Figma node id
  frameId: string;             // parent frame
  pageId: string;
  frameName: string;
  pageName: string;
  x: number;                   // canvas x
  y: number;                   // canvas y
  width: number | null;        // if region
  height: number | null;
  confidence: number;          // 0–1
};
```

### ExportedImage
```ts
type ExportedImage = {
  id: string;
  fileId: string;
  nodeId: string;
  frameId: string;
  url: string;                 // original Figma export URL
  path: string;                // local/blob path
  scale: number;               // 1x, 2x...
};
```

### ReviewCard
```ts
type ReviewCard = {
  id: string;
  commentId: string;
  commentText: string;
  commentThread: string[];     // all replies
  author: string;
  createdAt: Date;
  fileId: string;
  frameName: string;
  pageName: string;
  targetNodeName: string;
  targetNodeType: string;
  nearbyLayerNames: string[];

  fullFrameImageId: string;
  contextCropImageId: string;  // medium zoom
  tightCropImageId: string;    // tight around pin
  annotatedImageId: string;    // with bounding box / marker

  reviewRoundId: string | null; // e.g. "1–checkout-review"
};
```

### LLMAssessment
```ts
type LLMAssessment = {
  reviewCardId: string;
  elementTarget: string;       // "CTA button", "hero card", etc.
  issueType: "visual_polish" | "spacing_layout" | "hierarchy" | "copy_content" | "interaction" | "accessibility" | "product_decision" | "bug" | "ambiguous" | "no_action";
  actionability: "must_fix" | "can_postpone" | "no_action" | "needs_clarification";
  suggestedAction: string;
  needsHumanClarification: boolean;
  ambiguityReason: string | null;
  priorityHint: "high" | "medium" | "low";
  rawLLMOutput: string;        // debug
};
```

### IssueCluster
```ts
type IssueCluster = {
  id: string;
  title: string;               // generated from comments
  summary: string;
  reviewRoundId: string;
  frameId: string;
  frameName: string;
  pageId: string;
  pageName: string;
  targetNodeIds: string[];     // 1–N
  reviewCardIds: string[];     // underlying comments
  firstSeenAt: Date;
  lastSeenAt: Date;
  status: "open" | "in_progress" | "done" | "dismissed";
  suggestedAssignee: string | null;
  notes: string | null;
};
```

***

## 3. Figma API integration

### Auth
- User connects your app to Figma with OAuth or a PAT (Personal Access Token).  
- Store:  
  - access token,  
  - refresh token (if OAuth),  
  - scopes (`file_read`, `comments_read`).  

### Endpoints used
- `GET /v1/files/${file_key}` → file tree, nodes, page/frame structure.  
- `GET /v1/files/${file_key}/comments` → comment list + `client_meta`.  
- `GET /v1/images/${file_key}?ids=...&format=png` → export frame/node images.  

### Typical v1 job flow (per file)
1. `syncFile(fileKey: string)`  
   - `GET /v1/files/${fileKey}` → save file tree into DB.  
2. `syncComments(fileKey: string)`  
   - `GET /v1/files/${fileKey}/comments` → save `Comment` entries.  
3. `mapCommentsToNodes(fileKey: string)`  
   - For each `Comment.client_meta`, resolve:  
     - `nodeId` if present,  
     - otherwise infer frame + node from coords + file tree.  
   - Create `CommentTarget`.  
4. `exportAndCacheImages(fileKey: string)`  
   - Collect `nodeIds` from `CommentTarget`.  
   - `GET /v1/images/${fileKey}?ids=${nodeIds.join(',')}&format=png&scale=2` → download and save `ExportedImage`s.  
5. `generateCrops()`  
   - For each `CommentTarget`:  
     - Full frame image from `nodeId` (frame).  
     - Tight crop around `(x,y)` rectangle.  
     - Annotated crop: draw bounding box/marker over tight crop.  
   - Save as `ExportedImage` records.  
6. `createReviewCards()`  
   - Insert `ReviewCard` for each `Comment` using `CommentTarget` + `ExportedImage`s.  

This is your ingest loop per file / review round.

***

## 4. Image crop pipeline

### Inputs
- `frameImage` (PNG buffer)  
- `x`, `y`, `width`, `height` (from `CommentTarget` or `client_meta`)  

### Functions
- `loadImage(buffer: Buffer) -> Sharp`  
- `crop(frameImage, x, y, width, height, padding_pct = 0.2)`  
  - Expand rect by `padding_pct` (min 50px).  
  - Clamp to frame bounds.  
- `annotateImage(crop, bbox: {x,y,w,h}, marker: boolean)`  
  - Draw a thin border around the area.  
  - Optional small circle marker at `(x,y)`.  

### File naming
- `full-frame-{fileKey}-{nodeId}.png`  
- `context-crop-{commentId}.png`  
- `tight-crop-{commentId}.png`  
- `annotated-{commentId}.png`  

***

## 5. LLM pipeline (multimodal)

### 5.1. Inputs per `ReviewCard`
- `commentText` (and `commentThread` if short).  
- `frameName`, `pageName`, `targetNodeName`, `targetNodeType`, `nearbyLayerNames` (join as comma‑separated).  
- `contextCropImage` (main image).  
- Optional: `fullFrameImage` (longer context) or `tightCropImage`.  

### JSON schema for LLM output
```ts
interface LLMOutput {
  element_target: string;              // e.g. "primary CTA button"
  issue_type: "visual_polish" | "spacing_layout" | "hierarchy" | "copy_content" | "interaction" | "accessibility" | "product_decision" | "bug" | "ambiguous" | "no_action";
  actionability: "must_fix" | "can_postpone" | "no_action" | "needs_clarification";
  suggested_action: string;
  needs_human_clarification: boolean;
  ambiguity_reason: string | null;
  priority_hint: "high" | "medium" | "low";
}
```

### 5.2. Job flow
- `classifyReviewCard(reviewCardId: string)` job.  
- If model is multimodal (e.g. Gemini Vision, GPT‑4o, Claude 3.5), send:  
  - text + `contextCropImage` (or `annotatedImage`).  
- Insert result as `LLMAssessment` linked to `reviewCardId`.  

Treat this as a batch job with retries.

***

## 6. Clustering logic

Use:

- `comment.text` similarity (cosine or LLM‑based).  
- `comment_target.frameId` (same frame = more likely related).  
- `comment_target.nodeId` (same node = very likely related).  
- Spatial proximity: `distance(commentA.x, commentA.y, commentB.x, commentB.y)`.  
- `llmAssessment.issue_type`.  
- `llmAssessment.element_target` (if similar).  
- `created_at` window (same review round).  

### Pseudocode
```ts
const clusters = [];

for each ReviewCard r1 in reviewCards {
  let cluster = null;

  for each Cluster c of clusters {
    const score = similarity(
      r1.commentText, c.texts,
      r1.frameId, c.frameId,
      r1.nodeId, c.nodeIds,
      spatial(r1), c.spatial,
      r1.issueType, c.issueTypes,
    );

    if (score > threshold) {
      cluster = c;
      break;
    }
  }

  if (!cluster) {
    cluster = newCluster();
  }

  cluster.addCard(r1);
}
```

### Scoring ideas
- Same `frameId` → +0.3  
- Same `nodeId` → +0.4  
- `distance < 50px` → +0.1  
- `issue_type` matches → +0.15  
- `text_similarity > 0.7` → +0.3  
- Same `reviewRoundId` → +0.1  

***

## 7. Web UI / API endpoints (v1‑minimal)

### Routes
- `GET /review-digest` → main page  
- `GET /files` → list of synced files  
- `GET /files/:fileId/issues` → grouped issues for a file  
- `GET /files/:fileId/export.md` → Markdown export of issues  
- `POST /sync` → manual sync a file URL  

### `/files/:fileId/issues` response
```ts
{
  fileId: string;
  fileName: string;
  issues: {
    id: string;
    title: string;
    summary: string;
    frameName: string;
    pageName: string;
    estimatedEffort: "small" | "medium" | "large";
    status: "open" | "in_progress" | "done";
    commentCount: number;
    sampleCommentIds: string[];
    firstCardImage: {
      fullFrame: string;
      contextCrop: string;
      tightCrop: string;
      annotated: string;
    };
  }[];
}
```

***

## 8. MVP scope (v1)

### Must-have
- Figma OAuth / PAT.  
- `/sync` that fetches:  
  - `file`,  
  - `comments`,  
  - `file.nodes`,  
  - image exports, crops, annotations.  
- `ReviewCard` creation from `Comment` + `CommentTarget` + `ExportedImage`.  
- Multimodal LLM classification → `LLMAssessment`.  
- Clustering → `IssueCluster`.  
- `GET /files/:fileId/issues` (list of issues).  
- `GET /files/:fileId/export.md` (simple Markdown list).  

### Skip in v1
- Figma plugin.  
- Jira / Linear integration.  
- Real‑time webhooks.  
- Multi‑user permissions.  
- Fancy analytics.  

***

## 9. Recommended tech stack (Cursor‑friendly)

- Next.js App Router + TypeScript  
- Prisma + Postgres  
- `sharp` for image crops/annotate  
- `@google-ai/generativelanguage` or similar for Gemini multimodal (or OpenAI / Anthropic adapter)  
- Minimal job queue (e.g. database `job` table + `GET /jobs/run` endpoint)  

You can start from `GET /sync` → `syncFile` → `syncComments` → `createReviewCards`.

Sources
