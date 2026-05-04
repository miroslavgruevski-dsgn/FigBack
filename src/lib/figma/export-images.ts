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

  const batchSize = 50;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    try {
      const response = await getFileImages(fileKey, batch, token);
      if (response.err) {
        logger.error("Figma images API error", { fileKey, error: response.err, batchSize: batch.length });
        continue;
      }
      for (const [nodeId, url] of Object.entries(response.images)) {
        if (url) result.set(nodeId, url);
      }
    } catch (err) {
      logger.error("Image batch failed", {
        fileKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const stillMissing = unique.filter((id) => !result.has(id));
  if (stillMissing.length > 0) {
    for (let i = 0; i < stillMissing.length; i += batchSize) {
      const batch = stillMissing.slice(i, i + batchSize);
      try {
        const response = await getFileImages(fileKey, batch, token, 1);
        if (response.err) {
          logger.error("Figma images retry (1x)", {
            fileKey,
            error: response.err,
            batchSize: batch.length,
          });
          continue;
        }
        for (const [nodeId, url] of Object.entries(response.images)) {
          if (url) result.set(nodeId, url);
        }
      } catch (err) {
        logger.error("Image batch retry failed", {
          fileKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return result;
}
