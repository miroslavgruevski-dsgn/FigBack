import { createHmac } from "crypto";

const EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours

export function signImageUrl(
  imageId: string,
  secret: string
): { token: string; expires: number } {
  const expires = Date.now() + EXPIRY_MS;
  const payload = `${imageId}:${expires}`;
  const token = createHmac("sha256", secret).update(payload).digest("hex");
  return { token, expires };
}

export function verifyImageToken(
  imageId: string,
  token: string,
  expires: number,
  secret: string
): boolean {
  if (Date.now() > expires) return false;
  const payload = `${imageId}:${expires}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return token === expected;
}

export function buildSignedImageUrl(
  baseUrl: string,
  imageId: string,
  secret: string
): string {
  const { token, expires } = signImageUrl(imageId, secret);
  return `${baseUrl}/api/images/${imageId}?token=${token}&expires=${expires}`;
}
