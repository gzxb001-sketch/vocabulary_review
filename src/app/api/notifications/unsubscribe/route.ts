import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";

// 退订推送：删除当前浏览器订阅
export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: "missing endpoint" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId },
  });

  return NextResponse.json({ ok: true });
}
