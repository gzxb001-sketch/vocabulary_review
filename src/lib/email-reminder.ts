import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";

// 中国标准时间（Asia/Shanghai，UTC+8，无夏令时）
function shanghaiParts(now: Date): { hour: number; minute: number } {
  const t = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return { hour: t.getUTCHours(), minute: t.getUTCMinutes() };
}

function buildReminderHtml(dueCount: number): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#3d3d3d;">
      <div style="font-size:20px;font-weight:700;color:#4d7c0f;margin-bottom:12px;">🎋 竹墨词库</div>
      <div style="background:#f7f8f3;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:24px;">
        <p style="margin:0 0 8px;font-size:15px;">该复习啦！</p>
        <p style="margin:0;font-size:14px;color:#6b7280;">
          你有 <strong style="color:#4d7c0f;font-size:18px;">${dueCount}</strong> 个词待复习，
          现在花几分钟巩固一下，保持记忆曲线。
        </p>
      </div>
      <div style="margin-top:20px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/review"
           style="display:inline-block;background:#4d7c0f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;">
          开始复习
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
        如果你不再需要提醒，可在「竹墨词库」首页关闭邮件提醒。
      </p>
    </div>
  `;
}

// 给单个用户发送复习提醒（若当天有待复习词）
async function sendUserReminder(user: { id: string; email: string }, now: Date) {
  const dueCount = await prisma.reviewSchedule.count({
    where: { userId: user.id, nextReviewAt: { lte: now } },
  });
  if (dueCount === 0) return { userId: user.id, sent: false, reason: "no-due" };

  await sendEmail(user.email, {
    subject: "竹墨词库 · 今日复习提醒",
    text: `该复习啦！你有 ${dueCount} 个词待复习。`,
    html: buildReminderHtml(dueCount),
  });
  return { userId: user.id, sent: true };
}

// 定时任务入口：向所有「开启邮件提醒且当前时间匹配」的用户发送提醒
export async function sendDueReminders(now = new Date()) {
  const { hour, minute } = shanghaiParts(now);

  const users = await prisma.user.findMany({
    where: {
      emailReminderEnabled: true,
      emailReminderHour: hour,
      emailReminderMinute: minute,
    },
    select: { id: true, email: true },
  });

  const results: Array<{ userId: string; sent: boolean; reason?: string; error?: string }> = [];
  for (const user of users) {
    try {
      results.push(await sendUserReminder(user, now));
    } catch (e: unknown) {
      results.push({
        userId: user.id,
        sent: false,
        error: (e as Error)?.message || String(e),
      });
    }
  }

  return { matched: users.length, results };
}
