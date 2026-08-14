import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { clearAuthCookie } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTEMPTS = 5; // 验证码最多尝试 5 次，超过即作废

export async function POST(req: NextRequest) {
  try {
    const { email, code, newPassword } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").trim();
    const password = String(newPassword || "");

    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ message: "邮箱格式不正确" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json({ message: "验证码格式不正确" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: "密码至少需要 6 位" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ message: "验证码错误或已过期" }, { status: 400 });
    }

    const record = await prisma.passwordResetCode.findFirst({
      where: {
        email: normalizedEmail,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!record) {
      return NextResponse.json({ message: "验证码错误或已过期" }, { status: 400 });
    }

    const valid = await bcrypt.compare(normalizedCode, record.codeHash);
    if (!valid) {
      const attempts = record.attempts + 1;
      await prisma.passwordResetCode.update({
        where: { id: record.id },
        data: { attempts, usedAt: attempts >= MAX_ATTEMPTS ? new Date() : null },
      });
      return NextResponse.json({ message: "验证码错误或已过期" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetCode.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // 清掉当前设备会话（如果存在），强制用新密码重新登录
    await clearAuthCookie();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("reset-password failed:", (error as Error)?.message || error);
    return NextResponse.json({ message: "重置失败，请稍后重试" }, { status: 500 });
  }
}
