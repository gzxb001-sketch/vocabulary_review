import { NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/email-reminder";

// 定时发送入口：由外部 cron（如 Vercel Cron）每分钟调用一次。
// 若配置了 CRON_SECRET，则需在 Authorization: Bearer <CRON_SECRET> 中携带。
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendDueReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || String(e) },
      { status: 500 },
    );
  }
}
