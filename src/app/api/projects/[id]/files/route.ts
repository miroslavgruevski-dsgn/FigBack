import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { extractFileKey, getFile } from "@/lib/figma/client";
import { getFigmaToken } from "@/lib/figma/token";

const addSchema = z.object({
  url: z.string().url(),
});

const deleteSchema = z.object({
  fileId: z.string().min(1),
});

const patchSchema = z.object({
  fileId: z.string().min(1),
  includedPages: z.array(z.string()).optional(),
  includedFrames: z.array(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const fileKey = extractFileKey(parsed.data.url);
  if (!fileKey) {
    return NextResponse.json({ error: "Invalid Figma URL" }, { status: 400 });
  }

  const existing = await prisma.figmaFile.findUnique({ where: { fileKey } });
  if (existing) {
    return NextResponse.json(
      { error: "This file is already linked to a project" },
      { status: 409 }
    );
  }

  let fileName = `File ${fileKey.slice(0, 8)}`;
  try {
    const token = await getFigmaToken(id);
    if (token) {
      const figmaData = await getFile(fileKey, token);
      if (figmaData.name) fileName = figmaData.name;
    }
  } catch {
    // keep placeholder if Figma API fails
  }

  const file = await prisma.figmaFile.create({
    data: {
      projectId: id,
      fileKey,
      url: parsed.data.url,
      name: fileName,
    },
  });

  return NextResponse.json(file, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const file = await prisma.figmaFile.findFirst({
    where: { id: parsed.data.fileId, projectId: id },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await prisma.figmaFile.delete({ where: { id: parsed.data.fileId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const file = await prisma.figmaFile.findFirst({
    where: { id: parsed.data.fileId, projectId: id },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const updated = await prisma.figmaFile.update({
    where: { id: parsed.data.fileId },
    data: {
      ...(parsed.data.includedPages !== undefined && {
        includedPages: parsed.data.includedPages,
      }),
      ...(parsed.data.includedFrames !== undefined && {
        includedFrames: parsed.data.includedFrames,
      }),
    },
  });

  return NextResponse.json(updated);
}
