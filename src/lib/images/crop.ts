import sharp from "sharp";

interface CropOptions {
  pinX: number;
  pinY: number;
  imageWidth: number;
  imageHeight: number;
}

export async function contextCrop(
  imageBuffer: Buffer,
  options: CropOptions
): Promise<Buffer> {
  const { pinX, pinY, imageWidth, imageHeight } = options;
  const size = 400;

  const left = Math.max(0, Math.round(pinX - size / 2));
  const top = Math.max(0, Math.round(pinY - size / 2));
  const width = Math.min(size, imageWidth - left);
  const height = Math.min(size, imageHeight - top);

  if (width <= 0 || height <= 0) return imageBuffer;

  return sharp(imageBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}

export async function tightCrop(
  imageBuffer: Buffer,
  options: CropOptions
): Promise<Buffer> {
  const { pinX, pinY, imageWidth, imageHeight } = options;
  const size = 150;

  const left = Math.max(0, Math.round(pinX - size / 2));
  const top = Math.max(0, Math.round(pinY - size / 2));
  const width = Math.min(size, imageWidth - left);
  const height = Math.min(size, imageHeight - top);

  if (width <= 0 || height <= 0) return imageBuffer;

  return sharp(imageBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}

export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}
