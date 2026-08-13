import { sendDueReminders } from "@/lib/email-reminder";

const g = globalThis as unknown as { __emailSchedulerStarted?: boolean };

// 在服务器启动时调用一次，启动「每分钟检查一次」的邮件提醒调度器。
// 用于本地/自托管（长期运行的 Node 进程）。部署到 Vercel 等 serverless
// 平台时，建议改用 Vercel Cron 调 /api/email/send。
export function startEmailScheduler() {
  if (g.__emailSchedulerStarted) return;
  g.__emailSchedulerStarted = true;

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

  // 进程启动后每分钟执行一次；精确到分钟的时间匹配保证了同一用户不会被重复发送
  setInterval(tick, intervalMs);

  console.log(`[email-scheduler] 已启动，每 ${intervalMs / 1000} 秒检查一次`);
}
