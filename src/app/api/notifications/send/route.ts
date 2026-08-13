import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";
import { getWebPush } from "@/lib/web-push";

// 发送推送：向当前用户的全部订阅发送（手动触发/测试用）
export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  const payload: { title: string; body: string; url: string } = {
    title: "竹墨词库",
    body: "该复习啦，保持记忆曲线！",
    url: "/review",
  };
  try {
    const b = await req.json();
    if (typeof b?.title === "string") payload.title = b.title;
    if (typeof b?.body === "string") payload.body = b.body;
    if (typeof b?.url === "string") payload.url = b.url;
  } catch {}

  const subs = await prisma.pushSubscription.findMany({
    where: { userId, enabled: true },
  });

  if (subs.length === 0) {
    return NextResponse.json({ sent: 0, message: "no subscriptions" });
  }

  let webpush;
  try {
    webpush = getWebPush();
  } catch {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      // 订阅失效（浏览器已移除）时清理
      if (status === 404 || status === 410) {
        await prisma.pushSubscription
          .delete({ where: { endpoint: sub.endpoint } })
          .catch(() => {});
      }
    }
  }

  return NextResponse.json({ sent });
}
