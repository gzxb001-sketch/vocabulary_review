import { prisma } from "@/lib/db";

/** 日期 → 本地时区 "YYYY-M-D" 键（月/日不带前导零，与历史实现一致） */
export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
