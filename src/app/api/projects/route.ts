import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { extractFileKey } from "@/lib/figma/client";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  urls: z.array(z.string().url()).min(1).max(20),
});

export async function GET() {
  const projects = await prisma.project.findMany({
    where: { archived: false },
    include: {
      files: { select: { id: true, name: true, fileKey: true, lastError: true, lastSyncedAt: true } },
      _count: { select: { rounds: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, urls } = parsed.data;

  try {
    const files = urls.map((url) => {
      const fileKey = extractFileKey(url);
      if (!fileKey) throw new Error(`Invalid Figma URL: ${url}`);
      return { fileKey, url, name: `File ${fileKey.slice(0, 8)}` };
    });

    const project = await prisma.project.create({
      data: {
        name,
        files: {
          create: files,
        },
      },
      include: { files: true },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("Invalid Figma URL:")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Could not create project. Try again." },
      { status: 500 }
    );
  }
}
