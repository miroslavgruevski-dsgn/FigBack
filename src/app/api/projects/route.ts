import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { extractFileKey } from "@/lib/figma/client";

const DUPLICATE_FILE_MSG =
  "This Figma file is already linked to another project. Remove it from that project first, or open that project instead.";

function isDuplicateFileKeyError(e: Prisma.PrismaClientKnownRequestError): boolean {
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (target === undefined || target === null) return true;
  const fields = Array.isArray(target) ? target : [String(target)];
  return fields.some((f) => String(f).includes("fileKey"));
}

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

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (isDuplicateFileKeyError(e)) {
        return NextResponse.json({ error: DUPLICATE_FILE_MSG }, { status: 409 });
      }
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid reference. Refresh and try again." },
          { status: 400 }
        );
      }
    }

    console.error(e);
    return NextResponse.json(
      { error: "Could not create project. Try again." },
      { status: 500 }
    );
  }
}
