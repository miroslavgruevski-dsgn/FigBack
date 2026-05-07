import { NextResponse } from "next/server";

/** Liveness: returns if the Node process can respond. Use `/api/health/ready` for DB and queue signals. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
