import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/figma/client";
import { getFigmaToken } from "@/lib/figma/token";

export async function GET() {
  const token = await getFigmaToken();
  if (!token) {
    return NextResponse.json({ valid: false, error: "No token configured" });
  }

  const result = await verifyToken(token);
  return NextResponse.json(result);
}
