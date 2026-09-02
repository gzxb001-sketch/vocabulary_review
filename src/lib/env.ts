// 服务端环境变量集中校验。
//
// 规则：
// - 密钥只允许在服务端（api routes / lib）读取；客户端组件只能使用
//   NEXT_PUBLIC_ 前缀变量。
// - 标记为「生产必需」的变量在生产环境启动时校验，缺失立即抛错（fail fast），
//   避免带病部署（如 JWT 缺失时回退到可预测密钥）。
// - 标记为「生产强烈建议」的变量缺失时打印告警，不阻断启动。

type EnvCheck = {
  key: string;
  level: "required" | "recommended";
  message: string;
};

const CHECKS: EnvCheck[] = [
  {
    key: "DATABASE_URL",
    level: "required",
    message: "数据库连接串未配置",
  },
  {
    key: "JWT_SECRET",
    level: "required",
    message: "JWT 签名密钥未配置，缺失时鉴权会直接报错",
  },
  {
    key: "CRON_SECRET",
    level: "recommended",
    message: "/api/email/send 定时触发接口未设防，任何人可调用；请配置 CRON_SECRET 并在 cron 请求头携带 Authorization: Bearer <CRON_SECRET>",
  },
  {
    key: "SMTP_PASS",
    level: "recommended",
    message: "SMTP 授权码未配置，邮件提醒功能不可用",
  },
];

/** 生产环境启动时调用；缺失「必需」变量抛错，「建议」变量打印告警 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  for (const { key, level, message } of CHECKS) {
    const value = process.env[key];
    const missing = !value || !value.trim();
    if (!missing) continue;

    if (level === "required") {
      throw new Error(`[env] 生产环境缺少必需环境变量 ${key}：${message}`);
    }
    console.warn(`[env] 生产环境建议配置 ${key}：${message}`);
  }
}
