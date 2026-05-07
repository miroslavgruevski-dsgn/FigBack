import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";

type GuardResult =
  | { ok: true; session: Session; email: string | null }
  | { ok: false; response: NextResponse };

export async function requireApiSession(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, session, email: session.user.email ?? null };
}

export function canManageSettings(email: string | null): boolean {
  const raw = process.env.SETTINGS_ADMIN_EMAILS?.trim() ?? "";
  if (!raw) return true;
  if (!email) return false;
  const allowed = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
