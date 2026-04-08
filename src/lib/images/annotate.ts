import sharp from "sharp";

export async function annotatePinOnImage(
  imageBuffer: Buffer,
  pinX: number,
  pinY: number
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) return imageBuffer;

  const cx = Math.round(Math.min(Math.max(pinX, 8), width - 8));
  const cy = Math.round(Math.min(Math.max(pinY, 8), height - 8));

  const markerSvg = Buffer.from(`
    <svg width="${width}" height="${height}">
      <circle cx="${cx}" cy="${cy}" r="12" fill="rgba(109, 92, 231, 0.3)" stroke="#6D5CE7" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="4" fill="#6D5CE7"/>
    </svg>
  `);

  return sharp(imageBuffer)
    .composite([{ input: markerSvg, blend: "over" }])
    .png()
    .toBuffer();
}
