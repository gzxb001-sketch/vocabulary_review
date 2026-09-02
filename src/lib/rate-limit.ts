// 简易内存限流：用于登录/注册等接口的防暴力破解。
//
// 注意：这是「尽力而为」的限流 —— 内存 Map 在 serverless 多实例 / 冷启动下不共享，
// 无法作为分布式限流的最终方案。生产环境若有更高要求，可替换为 Upstash Redis 等集中式存储。
// 对个人规模的项目，它能有效抵御单实例内的连续爆破尝试。

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

/**
 * 基于固定窗口的限流检查。
 * @param key 限流维度键（如 `${ip}:${email}`）
 * @param max 窗口内最大允许次数
 * @param windowMs 窗口时长（毫秒）
 */
export function rateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  // 无记录或窗口已过期：重置窗口
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= max) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** 清除某个键的限流记录（例如登录成功后重置失败计数）。 */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/** 从请求头解析客户端 IP（兼容 Vercel 的 x-forwarded-for）。 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// 导出内部 Map 以便在测试中重置状态（避免用例间相互污染）
export function __resetRateLimitForTest(): void {
  buckets.clear();
}
