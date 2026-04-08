import { NextRequest, NextResponse } from "next/server";
import { verifyImageToken } from "@/lib/images/sign-url";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const expires = parseInt(searchParams.get("expires") || "0", 10);

  const secret = process.env.IMAGE_SIGN_SECRET;
  if (!secret || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyImageToken(id, token, expires, secret)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  // TODO: Fetch from Vercel Blob private storage by image ID
  // For now, return placeholder
  return NextResponse.json(
    { error: "Image not found" },
    { status: 404 }
  );
}
