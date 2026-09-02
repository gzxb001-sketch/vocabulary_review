import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";

// 提醒调度采用「窗口匹配 + 当日去重」：
// - 用户设定的时刻是「最早发送时刻」而非精确时刻——只要当前时间已越过设定时刻
//   （上海时间）且今天尚未发送，就发送。cron 抖动、延迟、低频 cron（每天一次）都能容忍。
// - emailLastSentAt 记录实际发送时刻，保证同一自然日（上海时间）绝不重发。
// - 发送失败不写 lastSentAt，下一个 cron 周期自动重试。

// 中国标准时间（Asia/Shanghai，UTC+8，无夏令时）
export function shanghaiParts(now: Date): { hour: number; minute: number } {
  const t = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return { hour: t.getUTCHours(), minute: t.getUTCMinutes() };
}

/** 上海时区「今天 00:00」对应的 UTC 时刻 */
export function startOfShanghaiDay(now: Date): Date {
  const t = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  t.setUTCHours(0, 0, 0, 0);
  return new Date(t.getTime() - 8 * 60 * 60 * 1000);
}

export type ReminderUser = {
  id: string;
  email: string;
  emailReminderHour: number;
  emailReminderMinute: number;
  emailLastSentAt: Date | null;
};

/**
 * 判断用户当前是否应收到提醒：
 * 当前时刻已越过其设定时刻，且 emailLastSentAt 早于今天（上海时间）零点。
 */
export function isUserDueForReminder(user: ReminderUser, now: Date): boolean {
  const { hour, minute } = shanghaiParts(now);
  const nowMinuteOfDay = hour * 60 + minute;
  const scheduledMinuteOfDay = user.emailReminderHour * 60 + user.emailReminderMinute;
  if (nowMinuteOfDay < scheduledMinuteOfDay) return false;

  if (!user.emailLastSentAt) return true;
  return user.emailLastSentAt.getTime() < startOfShanghaiDay(now).getTime();
}

// 生成应用基础 URL：优先 NEXT_PUBLIC_APP_URL，其次 Vercel 自动注入的生产域名
function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "";
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
        <a href="${appBaseUrl()}/review"
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

// 定时任务入口：向所有「已到提醒窗口且今日未发送」的用户发送提醒
export async function sendDueReminders(now = new Date()) {
  const startOfToday = startOfShanghaiDay(now);

  // 先在库层面用「今日未发送」缩小范围；时间窗口在内存中过滤（个人规模用户量小）
  const users = await prisma.user.findMany({
    where: {
      emailReminderEnabled: true,
      OR: [{ emailLastSentAt: null }, { emailLastSentAt: { lt: startOfToday } }],
    },
    select: {
      id: true,
      email: true,
      emailReminderHour: true,
      emailReminderMinute: true,
      emailLastSentAt: true,
    },
  });

  const dueUsers = users.filter((u) => isUserDueForReminder(u, now));

  const results: Array<{ userId: string; sent: boolean; reason?: string; error?: string }> = [];
  for (const user of dueUsers) {
    try {
      const result = await sendUserReminder(user, now);
      // 仅在实际发出时记录发送时刻：当日不再重发；失败留给下个周期重试
      if (result.sent) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailLastSentAt: now },
        });
      }
      results.push(result);
    } catch (e: unknown) {
      results.push({
        userId: user.id,
        sent: false,
        error: (e as Error)?.message || String(e),
      });
    }
  }

  return { matched: dueUsers.length, results };
}
