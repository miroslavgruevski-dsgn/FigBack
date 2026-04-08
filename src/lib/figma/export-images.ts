import { put } from "@vercel/blob";
import { getFileImages } from "./client";
import { logger } from "@/lib/logger";

export async function exportFrameImages(
  fileKey: string,
  frameIds: string[],
  token: string
): Promise<Map<string, string>> {
  if (frameIds.length === 0) return new Map();

  const unique = [...new Set(frameIds)];
  const result = new Map<string, string>();

  const batchSize = 10;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const response = await getFileImages(fileKey, batch, token);

    if (response.err) {
      logger.error("Image export error", { fileKey, error: response.err });
      continue;
    }

    for (const [nodeId, url] of Object.entries(response.images)) {
      if (!url) continue;

      try {
        const imageRes = await fetch(url);
        if (!imageRes.ok) continue;

        const buffer = Buffer.from(await imageRes.arrayBuffer());
        if (buffer.length === 0) continue;

        const blob = await put(
          `figback/${fileKey}/${nodeId}.png`,
          buffer,
          {
            access: "public",
            contentType: "image/png",
          }
        );

        result.set(nodeId, blob.url);
      } catch (err) {
        logger.error("Failed to upload image", { nodeId, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return result;
}
