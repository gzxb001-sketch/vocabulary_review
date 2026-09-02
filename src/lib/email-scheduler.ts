import { sendDueReminders } from "@/lib/email-reminder";

const g = globalThis as unknown as { __emailSchedulerStarted?: boolean };

// 在服务器启动时调用一次，启动「每分钟检查一次」的邮件提醒调度器。
// 用于本地/自托管（长期运行的 Node 进程）。部署到 Vercel 等 serverless
// 平台时，建议改用 Vercel Cron 调 /api/email/send。
export function startEmailScheduler() {
  if (g.__emailSchedulerStarted) return;
  g.__emailSchedulerStarted = true;

  // serverless 平台（Vercel）上 setInterval 不会常驻运行，定时器会在请求结束后被冻结/销毁。
  // 此时应改用外部 cron（vercel.json 的 crons 或 cron-job.org）每分钟调用 /api/email/send。
  if (process.env.VERCEL === "1") {
    console.log("[email-scheduler] 检测到 Vercel 环境，跳过常驻定时器；请使用 Vercel Cron 或外部 cron 调用 /api/email/send");
    return;
  }

  const intervalMs = 60 * 1000;

  const tick = async () => {
    try {
      const result = await sendDueReminders();
      if (result.matched > 0) {
        console.log("[email-scheduler] 命中", result.matched, "位用户:", JSON.stringify(result.results));
      }
    } catch (e) {
      console.error("[email-scheduler] 发送失败:", e);
    }
  };

  // 进程启动后每分钟执行一次；「窗口匹配 + lastSentAt 当日去重」保证同一用户不会被重复发送
  setInterval(tick, intervalMs);

  console.log(`[email-scheduler] 已启动，每 ${intervalMs / 1000} 秒检查一次`);
}
