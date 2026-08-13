import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";
import { sendEmail } from "@/lib/mailer";

// 手动测试：向当前用户邮箱发送一封测试邮件，用于验证 SMTP 配置是否正确
export async function POST() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return authError();

  try {
    await sendEmail(user.email, {
      subject: "竹墨词库 · 邮件提醒测试",
      text: "测试成功！如果你收到这封邮件，说明邮件提醒已配置正确。",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#3d3d3d;">
          <div style="font-size:20px;font-weight:700;color:#4d7c0f;margin-bottom:12px;">🎋 竹墨词库</div>
          <p style="margin:0;font-size:15px;">测试成功！如果你收到这封邮件，说明邮件提醒已配置正确。</p>
        </div>
      `,
    });
    return NextResponse.json({ ok: true, sentTo: user.email });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || String(e) },
      { status: 500 },
    );
  }
}
