import { NextRequest, NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push/send";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await sendPushToAll({
    title: "FigBack Test",
    body: "Push notifications are working!",
    url: "/settings",
  });
  return NextResponse.json(result);
}
