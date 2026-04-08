import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFile } from "@/lib/figma/client";
import { getFigmaToken } from "@/lib/figma/token";

const FRAME_TYPES = new Set([
  "FRAME",
  "COMPONENT",
  "COMPONENT_SET",
  "SECTION",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = req.nextUrl.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await prisma.figmaFile.findFirst({
    where: { id: fileId, projectId: id },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const token = await getFigmaToken(id);
  if (!token) {
    return NextResponse.json(
      { error: "No Figma access token configured" },
      { status: 400 }
    );
  }

  try {
    const figmaFile = await getFile(file.fileKey, token);
    const pages = (figmaFile.document.children ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      children: (page.children ?? [])
        .filter((child) => FRAME_TYPES.has(child.type))
        .map((child) => ({
          id: child.id,
          name: child.name,
          type: child.type,
        })),
    }));

    return NextResponse.json({ pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch file";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
