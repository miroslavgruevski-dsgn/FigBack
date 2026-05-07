import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isCsrfOriginAllowed } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { extractFileKey } from "@/lib/figma/client";
import { createProjectBodySchema } from "@/lib/validation/project-create";
import { requireApiSession } from "@/lib/api-guards";

const DUPLICATE_FILE_MSG =
  "This Figma file is already linked to another project. Remove it from that project first, or open that project instead.";

export async function GET(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const includeArchivedParam = req.nextUrl.searchParams.get("includeArchived");
  const includeArchived =
    includeArchivedParam === "1" ||
    includeArchivedParam === "true" ||
    includeArchivedParam === "all";

  const projects = await prisma.project.findMany({
    where: includeArchived ? undefined : { archived: false },
    include: {
      files: { select: { id: true, name: true, fileKey: true, lastError: true, lastSyncedAt: true } },
      _count: { select: { rounds: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  if (!isCsrfOriginAllowed(req)) {
    return NextResponse.json(
      { error: "CSRF rejected", code: "csrf_rejected" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", code: "invalid_json" },
      { status: 400 }
    );
  }

  const parsed = createProjectBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid input",
        code: "validation_failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { name, urls } = parsed.data;

  try {
    const files = urls.map((url) => {
      const fileKey = extractFileKey(url);
      if (!fileKey) throw new Error(`Invalid Figma URL: ${url}`);
      return { fileKey, url, name: fileKey };
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
      return NextResponse.json(
        { error: msg, code: "invalid_figma_url" },
        { status: 400 }
      );
    }

    if (e instanceof Error && e.name === "PrismaClientInitializationError") {
      console.error(e);
      return NextResponse.json(
        {
          error:
            "Cannot connect to the database. Check DATABASE_URL, network access, and that the database is running.",
          code: "db_unreachable",
        },
        { status: 503 }
      );
    }

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: DUPLICATE_FILE_MSG, code: "duplicate_file" },
          { status: 409 }
        );
      }
      if (e.code === "P2003") {
        return NextResponse.json(
          {
            error: "Invalid reference. Refresh and try again.",
            code: "prisma_fk",
          },
          { status: 400 }
        );
      }
      if (e.code === "P1001" || e.code === "P1017") {
        console.error(e);
        return NextResponse.json(
          {
            error:
              "Cannot reach the database server. Check DATABASE_URL and that your database accepts connections.",
            code: "db_unreachable",
          },
          { status: 503 }
        );
      }
      if (e.code === "P1003") {
        console.error(e);
        return NextResponse.json(
          {
            error:
              "Database does not exist or DATABASE_URL points at the wrong database.",
            code: "db_not_found",
          },
          { status: 503 }
        );
      }
      if (e.code === "P2021") {
        console.error(e);
        return NextResponse.json(
          {
            error:
              "Database schema is missing tables. Run migrations against this database (e.g. prisma migrate deploy).",
            code: "migration_required",
          },
          { status: 503 }
        );
      }
      if (e.code === "P2022") {
        console.error(e);
        return NextResponse.json(
          {
            error:
              "Database is missing a column the app expects. Deploy the latest migrations to this database (prisma migrate deploy).",
            code: "migration_required",
          },
          { status: 503 }
        );
      }
      console.error(e);
      return NextResponse.json(
        {
          error: "Could not create project. Try again.",
          code: `prisma_${e.code}`,
        },
        { status: 500 }
      );
    }

    console.error(e);
    return NextResponse.json(
      {
        error: "Could not create project. Try again.",
        code: "server_error",
      },
      { status: 500 }
    );
  }
}
