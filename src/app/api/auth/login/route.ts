import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { setAuthCookie, clearAuthCookie } from "@/lib/auth";
import { rateLimit, clearRateLimit, getClientIp } from "@/lib/rate-limit";

// 登录限流：同一 IP + 邮箱 15 分钟内最多 5 次失败尝试，防止暴力撞库
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "邮箱和密码不能为空" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ip = getClientIp(req);
    const rateKey = `${ip}:${normalizedEmail}`;

    const limit = rateLimit(rateKey, { max: LOGIN_MAX_ATTEMPTS, windowMs: LOGIN_WINDOW_MS });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: `尝试过于频繁，请 ${Math.ceil(limit.retryAfterSec / 60)} 分钟后再试` },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json({ message: "邮箱未注册" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json({ message: "密码错误" }, { status: 401 });
    }

    // 登录成功，清除该邮箱的失败计数
    clearRateLimit(rateKey);
    await setAuthCookie(user.id);

    return NextResponse.json({ ok: true, email: user.email });
  } catch (error: any) {
    console.error("login failed:", error.message);
    return NextResponse.json({ message: "登录失败，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
