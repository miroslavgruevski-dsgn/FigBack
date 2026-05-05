import type { NextRequest } from "next/server";

function loopbackHost(host: string): string {
  if (host.startsWith("127.0.0.1:")) return `localhost:${host.slice("127.0.0.1:".length)}`;
  if (host === "127.0.0.1") return "localhost";
  if (host.startsWith("[::1]:")) return `localhost:${host.slice("[::1]:".length)}`;
  if (host === "[::1]") return "localhost";
  return host;
}

function stripLeadingWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** Normalize host for same-site comparison (loopback + optional www). */
export function normalizeHostForCsrf(host: string): string {
  return stripLeadingWww(loopbackHost(host));
}

export function isCsrfOriginAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originNorm = normalizeHostForCsrf(new URL(origin).host);
    const forwarded = req.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const headerRaw = req.headers.get("host")?.trim() ?? "";
    const reqUrlHost = normalizeHostForCsrf(new URL(req.url).host);
    const nextHostNorm = normalizeHostForCsrf(req.nextUrl.host);
    const forwardedNorm = forwarded ? normalizeHostForCsrf(forwarded) : "";
    const headerNorm = headerRaw ? normalizeHostForCsrf(headerRaw) : "";

    const candidates = [nextHostNorm, reqUrlHost, forwardedNorm, headerNorm].filter(
      Boolean
    );

    if (candidates.some((c) => c === originNorm)) return true;
    return false;
  } catch {
    return false;
  }
}
