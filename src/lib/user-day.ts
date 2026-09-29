// 用户日（北京时区，UTC+8）的纯函数工具。
// 产品面向国内用户，而部署环境（Vercel）是 UTC：任何「今天」的语义都必须
// 用这里的实现，而不是服务器本地 setHours(0,0,0,0) 或 UTC 的 toISOString 切片，
// 否则北京 0-8 点的行为会被记到前一天。

/**
 * 北京时区「今天 00:00」对应的 UTC 时刻
 * （例：北京 9 月 13 日 0 点 = UTC 9 月 12 日 16:00）
 */
export function userDayStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      8 * 60 * 60 * 1000,
  );
}

/** 日期 → 北京时区 "YYYY-M-D" 键（月份 0 基、不带前导零，与历史实现一致；仅用于内部比较） */
export function toDayKey(d: Date): string {
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}-${shifted.getUTCDate()}`;
}

/** 北京时区的 "YYYY-MM-DD"（月/日 1 基补零；用于用户可见展示与本地存档比较） */
export function beijingDateStr(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
