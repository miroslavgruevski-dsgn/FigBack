import { createHmac, timingSafeEqual } from "crypto";

const JWT_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SharePayload {
  projectId: string;
  roundId: string;
}

export function createShareToken(
  payload: SharePayload,
  secret: string
): string {
  const exp = Date.now() + JWT_EXPIRY;
  const data = JSON.stringify({ ...payload, exp });
  const encoded = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyShareToken(
  token: string,
  secret: string
): SharePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = createHmac("sha256", secret).update(encoded).digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return { projectId: data.projectId, roundId: data.roundId };
  } catch {
    return null;
  }
}
