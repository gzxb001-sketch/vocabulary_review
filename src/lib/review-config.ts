// 复习节奏配置：前后端共用的单次会话上限。
// 每日新词/复习配额的动态版在 sprint.ts（按考试日期分阶段），此处保留常规兜底值。
export const REVIEW_CAPS = {
  // 每日新词上限（从未复习过的词）
  newPerDay: 20,
  // 每日复习上限（复习过的旧词）
  reviewPerDay: 100,
  // 单次会话上限（达到后提示休息）
  sessionSize: 50,
} as const;
