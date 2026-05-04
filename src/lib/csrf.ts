import type { NextRequest } from "next/server";

function loopbackHost(host: string): string {
  if (host.startsWith("127.0.0.1:")) return `localhost:${host.slice("127.0.0.1:".length)}`;
  if (host === "127.0.0.1") return "localhost";
  if (host.startsWith("[::1]:")) return `localhost:${host.slice("[::1]:".length)}`;
  if (host === "[::1]") return "localhost";
  return host;
}

export function isCsrfOriginAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = loopbackHost(new URL(origin).host);
    const forwarded = req.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const headerHost = loopbackHost(req.headers.get("host")?.trim() ?? "");
    const nextHost = loopbackHost(req.nextUrl.host);

    if (originHost === nextHost) return true;
    if (forwarded && originHost === loopbackHost(forwarded)) return true;
    if (headerHost && originHost === headerHost) return true;
    return false;
  } catch {
    return false;
  }
}
