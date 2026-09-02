import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { setAuthCookie } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// 注册限流：同一 IP 1 小时内最多 10 次注册，防止批量注册垃圾账号
const REGISTER_MAX_ATTEMPTS = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`register:${ip}`, { max: REGISTER_MAX_ATTEMPTS, windowMs: REGISTER_WINDOW_MS });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: `注册过于频繁，请 ${Math.ceil(limit.retryAfterSec / 60)} 分钟后再试` },
        { status: 429 },
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "邮箱和密码不能为空" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ message: "邮箱格式不正确" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ message: "密码至少需要 6 位" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json({ message: "该邮箱已被注册" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });

    await setAuthCookie(user.id);

    return NextResponse.json({ ok: true, email: user.email });
  } catch (error: any) {
    console.error("register failed:", error.message);
    return NextResponse.json({ message: "注册失败，请稍后重试" }, { status: 500 });
  }
}
