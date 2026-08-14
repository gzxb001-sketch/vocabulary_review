import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000; // 验证码 10 分钟过期
const RESEND_COOLDOWN_MS = 60 * 1000; // 同一邮箱 60 秒内只能发一次

function buildCodeHtml(code: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#3d3d3d;">
      <div style="font-size:20px;font-weight:700;color:#4d7c0f;margin-bottom:12px;">🎋 竹墨词库</div>
      <div style="background:#f7f8f3;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:24px;">
        <p style="margin:0 0 8px;font-size:15px;">你正在重置密码。</p>
        <p style="margin:0;font-size:14px;color:#6b7280;">
          验证码：<strong style="color:#4d7c0f;font-size:24px;letter-spacing:4px;">${code}</strong>
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
          验证码 10 分钟内有效。如果这不是你本人的操作，请忽略本邮件。
        </p>
      </div>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ message: "邮箱格式不正确" }, { status: 400 });
    }

    // 防枚举：无论邮箱是否注册，都返回相同的响应文案
    const generic = NextResponse.json({
      ok: true,
      message: "如果该邮箱已注册，验证码已发送，请查收",
    });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (!user) return generic;

    // 限流：60 秒内同一邮箱只能请求一次
    const recent = await prisma.passwordResetCode.findFirst({
      where: {
        email: normalizedEmail,
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return NextResponse.json({ message: "发送太频繁，请稍后再试" }, { status: 429 });
    }

    const code = randomInt(0, 1000000).toString().padStart(6, "0");
    const codeHash = await bcrypt.hash(code, 10);

    await prisma.passwordResetCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await sendEmail(normalizedEmail, {
      subject: "竹墨词库 · 重置密码验证码",
      text: `你的验证码是 ${code}，10 分钟内有效。如果这不是你本人的操作，请忽略。`,
      html: buildCodeHtml(code),
    });

    return generic;
  } catch (error) {
    console.error("forgot-password failed:", (error as Error)?.message || error);
    return NextResponse.json({ message: "发送失败，请稍后重试" }, { status: 500 });
  }
}
