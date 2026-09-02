// 考前冲刺模式：根据考试日期把备考划分为四个阶段，动态调整每日配额。
//
// 设计原则（产品侧）：
// - 强化期加大输入但不激进（30/150），避免吓跑用户；
// - 冲刺期停止新词——考前两周学新词的性价比极低，全力巩固已学词；
// - 阶段只调整「量」，不改变 SRS 到期语义（排序优化归专项攻克模式）。

export type SprintPhase = "regular" | "strengthen" | "sprint" | "final";

export type SprintCaps = {
  newPerDay: number;
  reviewPerDay: number;
};

export type SprintInfo = {
  phase: SprintPhase;
  /** 距考试日期的自然日数；未设置或已过期为 null */
  daysLeft: number | null;
  caps: SprintCaps;
  label: string;
  hint: string;
};

// 常规配额与 review-config 保持一致
const REGULAR_CAPS: SprintCaps = { newPerDay: 20, reviewPerDay: 100 };

// 阶段边界（剩余天数，含端点）
const STRENGTHEN_LAST_DAY = 120;
const SPRINT_LAST_DAY = 14;
const FINAL_LAST_DAY = 3;

const PHASE_META: Record<SprintPhase, { label: string; hint: string }> = {
  regular: {
    label: "日常节奏",
    hint: "保持每天的新词输入与复习，稳步推进。",
  },
  strengthen: {
    label: "强化期",
    hint: "距离考试还有充足时间，系统加大了每日新词与复习配额，多攒词汇量。",
  },
  sprint: {
    label: "冲刺期",
    hint: "考前两周性价比最高的是巩固已学词：已暂停新词排队，专注复习。",
  },
  final: {
    label: "考前收敛",
    hint: "最后一周只刷到期词，把学过的词守住，不必再开新词。",
  },
};

/** 计算距考试日期的自然日数（当天考试记为 0） */
export function daysUntilExam(examDate: Date, now: Date): number {
  const startOfDay = (d: Date) => {
    const c = new Date(d);
    c.setUTCHours(0, 0, 0, 0);
    return c.getTime();
  };
  return Math.round((startOfDay(examDate) - startOfDay(now)) / 86400000);
}

function phaseByDaysLeft(daysLeft: number): SprintPhase {
  if (daysLeft > STRENGTHEN_LAST_DAY) return "regular";
  if (daysLeft > SPRINT_LAST_DAY) return "strengthen";
  if (daysLeft > FINAL_LAST_DAY) return "sprint";
  return "final";
}

function capsByPhase(phase: SprintPhase): SprintCaps {
  switch (phase) {
    case "strengthen":
      return { newPerDay: 30, reviewPerDay: 150 };
    case "sprint":
    case "final":
      // 停止新词：到期新词顺延，复习配额拉满
      return { newPerDay: 0, reviewPerDay: 200 };
    default:
      return REGULAR_CAPS;
  }
}

/** 未设置考试日期或日期已过时的兜底（与全局 REVIEW_CAPS 一致） */
export const REGULAR_SPRINT_INFO: SprintInfo = {
  phase: "regular",
  daysLeft: null,
  caps: REGULAR_CAPS,
  ...PHASE_META.regular,
};

/**
 * 根据考试日期返回当前冲刺阶段信息。
 * examDate 为空或已过期时返回常规节奏。
 */
export function getSprintInfo(
  examDate: Date | null | undefined,
  now: Date = new Date(),
): SprintInfo {
  if (!examDate) return REGULAR_SPRINT_INFO;

  const daysLeft = daysUntilExam(examDate, now);
  if (daysLeft < 0) return REGULAR_SPRINT_INFO;

  const phase = phaseByDaysLeft(daysLeft);
  return {
    phase,
    daysLeft,
    caps: capsByPhase(phase),
    ...PHASE_META[phase],
  };
}
