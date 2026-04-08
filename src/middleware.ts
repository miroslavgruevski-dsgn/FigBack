import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicPaths = [
  "/auth",
  "/api/auth",
  "/api/cron",
  "/api/health",
  "/share",
  "/onboarding",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  if (!req.auth?.user) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|manifest|sw|workbox).*)",
  ],
};
