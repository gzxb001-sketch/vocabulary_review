// 跨 API 路由共享的输入校验小工具，避免各路由重复实现同一逻辑。

/** 邮箱格式（宽松校验：非空白@非空白.非空白，注册/找回/重置共用） */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 把任意输入收敛为 [min, max] 区间内的整数。
 * undefined/null 或无法解析为有限数字时返回 fallback ?? null。
 */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback?: number,
): number | null {
  if (value === undefined || value === null) return fallback ?? null;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback ?? null;
  return Math.min(max, Math.max(min, Math.round(n)));
}
