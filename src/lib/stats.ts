import { prisma } from "@/lib/db";

/**
 * 用户日的起点（北京时间 0 点）：产品面向国内用户，而部署环境（Vercel）是 UTC，
 * 用服务器本地 setHours(0,0,0,0) 会把北京 0-8 点的复习行为记到前一天。
 */
export function userDayStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      8 * 60 * 60 * 1000,
  );
}

/** 日期 → 北京时区 "YYYY-M-D" 键（月/日不带前导零，与历史实现一致） */
export function toDayKey(d: Date): string {
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}-${shifted.getUTCDate()}`;
}

/** 每日配额形状（sprint 与常规配置共有） */
export type DayCaps = { newPerDay: number; reviewPerDay: number };

/**
 * 今日复习进度（首页 hero 与 /api/review/today 共用口径）：
 * - reviewedToday: 今日（北京时区）复习过的「不同词数」——会话内重学的重复提交不重复计
 * - todayPlan: 今日计划 = 日初到期词数按配额封顶（新词/旧词分别计），一天内不缩小。
 *   旧实现用实时到期数当分母，越复习分母越小，进度永远对不上。
 */
export async function getReviewProgress(
  userId: string,
  caps: DayCaps,
  now: Date = new Date(),
): Promise<{ reviewedToday: number; dueNewNow: number; dueReviewNow: number; todayPlan: number }> {
  const dayStart = userDayStart(now);
  const [dueNewNow, dueReviewNow, reviewedTodayRows] = await Promise.all([
    prisma.reviewSchedule.count({ where: { userId, nextReviewAt: { lte: now }, reviewCount: 0 } }),
    prisma.reviewSchedule.count({ where: { userId, nextReviewAt: { lte: now }, reviewCount: { gt: 0 } } }),
    prisma.review.findMany({
      where: { userId, reviewedAt: { gte: dayStart } },
      distinct: ["wordId"],
      select: { wordId: true },
    }),
  ]);
  const reviewedWordIds = reviewedTodayRows.map((r) => r.wordId);

  // 把今日已复习的词归还到「日初到期」口径：当前 reviewCount === 1 ⇒ 日初还是新词
  let dueNewAtDayStart = dueNewNow;
  let dueReviewAtDayStart = dueReviewNow;
  if (reviewedWordIds.length > 0) {
    const schedules = await prisma.reviewSchedule.findMany({
      where: { userId, wordId: { in: reviewedWordIds } },
      select: { reviewCount: true },
    });
    for (const s of schedules) {
      if (s.reviewCount === 1) dueNewAtDayStart++;
      else dueReviewAtDayStart++;
    }
  }

  const todayPlan =
    Math.min(dueNewAtDayStart, caps.newPerDay) + Math.min(dueReviewAtDayStart, caps.reviewPerDay);

  return { reviewedToday: reviewedWordIds.length, dueNewNow, dueReviewNow, todayPlan };
}

/**
 * 连续打卡天数：向前追溯，有复习行为的那天算打卡。
 * 若今天尚未复习，则从昨天开始计。
 */
export async function calculateStreak(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const reviews = await prisma.review.findMany({
    where: { userId, reviewedAt: { gte: ninetyDaysAgo } },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: "desc" },
  });

  const reviewDays = new Set(reviews.map((r) => toDayKey(new Date(r.reviewedAt))));

  let streak = 0;
  const checkDate = new Date(now);
  if (!reviewDays.has(toDayKey(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 90; i++) {
    if (reviewDays.has(toDayKey(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 掌握口径：复习间隔已拉开到 21 天以上，且最近一次复习结果是「认识」。
 * 21 天（约三周）是记忆长期巩固的经典阈值——到达该间隔说明 SRS 已把这个词
 * 放进长间隔队列，用户无需短期内再担心遗忘。
 */
export const MASTERED_INTERVAL_DAYS = 21;

export async function countMasteredWords(userId: string): Promise<number> {
  return prisma.reviewSchedule.count({
    where: {
      userId,
      intervalDays: { gte: MASTERED_INTERVAL_DAYS },
      lastResult: "known",
    },
  });
}
