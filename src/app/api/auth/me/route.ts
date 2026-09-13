import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken, setAuthCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = token ? await verifyToken(token) : null;

  if (!userId) {
    // 携带了凭证但校验失败 ⇒ 已过期/被吊销，与从未登录区分开，供前端引导重新登录
    return NextResponse.json({ user: null, expired: Boolean(token) }, { headers: NO_STORE });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    // 凭证有效但用户已不存在（幽灵用户）：同样按过期处理
    return NextResponse.json({ user: null, expired: true }, { headers: NO_STORE });
  }

  // 滑动续期：活跃用户每次校验都重签 7 天窗口，日常回访不会被被动登出；
  // 真正连续 7 天未访问才需要重新登录
  await setAuthCookie(userId);

  return NextResponse.json({ user }, { headers: NO_STORE });
}
