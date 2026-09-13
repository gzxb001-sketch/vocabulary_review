import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";
import { clampInt } from "@/lib/validate";

// 订阅/更新推送：存储浏览器 PushSubscription 与每日提醒时间
export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  let body: {
    subscription?: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    remindHour?: number;
    remindMinute?: number;
    timezone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { subscription, remindHour, remindMinute, timezone } = body;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }
  if (endpoint.length > 2048 || p256dh.length > 200 || auth.length > 200) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  // endpoint 是本表的唯一键：先确认归属，避免用 update 分支抢占其他账号的订阅
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (existing && existing.userId !== userId) {
    return NextResponse.json({ error: "endpoint already registered" }, { status: 409 });
  }

  const data = {
    userId,
    p256dh,
    auth,
    remindHour: clampInt(remindHour, 0, 23) ?? 20,
    remindMinute: clampInt(remindMinute, 0, 59) ?? 0,
    timezone: typeof timezone === "string" && timezone ? timezone : "Asia/Shanghai",
    enabled: true,
  };

  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true, id: sub.id });
}
