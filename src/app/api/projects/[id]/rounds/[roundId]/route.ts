import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, roundId } = await params;

  const round = await prisma.reviewRound.findFirst({
    where: { id: roundId, projectId },
    select: { id: true },
  });

  if (!round) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  await prisma.reviewRound.delete({
    where: { id: roundId },
  });

  return NextResponse.json({ ok: true });
}
