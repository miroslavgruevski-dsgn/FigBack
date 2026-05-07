import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-guards";
import { getSetupStatus } from "@/lib/setup-status";

export async function GET() {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const status = await getSetupStatus();
  return NextResponse.json(status);
}
