// 产品埋点封装：所有漏斗事件集中在此定义，供应商可替换。
//
// 当前供应商：Vercel Web Analytics（部署在 Vercel 时于项目面板开启即可，无 cookie）。
// 开发环境不发送，改为写入 window.__zhumoEvents 并打印，便于本地验证事件参数。
//
// 北极星指标与事件对应关系：
// - 游客→注册转化率   guest_save_blocked + auth_success + word_save_success(convertedFromGuest)
// - 次日复习完成率     review_session_start / review_session_complete（按天聚合）
// - D7 留存            Vercel 面板按访客回访估算（页面自动上报 pageview）
// - 顽固词攻克率       后续专项攻克功能上线时补充

import { track } from "@vercel/analytics";

type EventProps = Record<string, string | number | boolean>;

export const ANALYTICS_EVENTS = {
  /** 游客保存被 401 拦截（模态弹出时刻），漏斗关键摩擦点 */
  guestSaveBlocked: "guest_save_blocked",
  /** 页内模态或登录页完成注册/登录 */
  authSuccess: "auth_success",
  /** 词条保存成功（首个词保存 = 激活） */
  wordSaveSuccess: "word_save_success",
  /** 已登录用户开始一次复习会话 */
  reviewSessionStart: "review_session_start",
  /** 复习会话结束（完成或提前结束） */
  reviewSessionComplete: "review_session_complete",
  /** 游客体验模式复习完成 */
  demoSessionComplete: "demo_session_complete",
  /** 用户设置考试日期，开启冲刺模式（招牌功能采纳信号） */
  sprintDateSet: "sprint_date_set",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

declare global {
  interface Window {
    __zhumoEvents?: Array<{ name: string; props?: EventProps; at: string }>;
  }
}

export function trackEvent(name: AnalyticsEvent, props?: EventProps): void {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV !== "production") {
    const entry = { name, props, at: new Date().toISOString() };
    (window.__zhumoEvents ??= []).push(entry);
    console.info("[analytics]", name, props ?? "");
    return;
  }

  try {
    track(name, props);
  } catch {
    // 埋点失败静默，不影响业务
  }
}
