import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [weeklyStats, streak] = await Promise.all([
      // 本周复习统计
      prisma.review.groupBy({
        by: ["reviewResult"],
        where: {
          userId,
          reviewedAt: { gte: sevenDaysAgo },
        },
        _count: { reviewResult: true },
      }),
      // 连续打卡天数
      calculateStreak(userId, now),
    ]);

    const total = weeklyStats.reduce((sum, s) => sum + s._count.reviewResult, 0);
    const knownCount = weeklyStats.find((s) => s.reviewResult === "known")?._count.reviewResult ?? 0;

    const wordCount = await prisma.word.count({ where: { userId } });
    const dueCount = await prisma.reviewSchedule.count({
      where: { userId, nextReviewAt: { lte: now } },
    });

    return NextResponse.json({
      weeklyTotal: total,
      weeklyKnownRate: total > 0 ? Math.round((knownCount / total) * 100) : 0,
      streak,
      wordCount,
      dueCount,
      weeklyTrend: await getWeeklyTrend(userId, now),
    });
  } catch {
    return NextResponse.json({
      weeklyTotal: 0,
      weeklyKnownRate: 0,
      streak: 0,
      wordCount: 0,
      dueCount: 0,
      weeklyTrend: [],
    });
  }
}

// 计算连续打卡天数（向前追溯，有复习行为的那天算打卡）
async function calculateStreak(
  userId: string,
  now: Date,
): Promise<number> {
  // 获取最近 90 天的每日复习记录
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const reviews = await prisma.review.findMany({
    where: { userId, reviewedAt: { gte: ninetyDaysAgo } },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: "desc" },
  });

  // 收集有复习行为的天（按日期去重）
  const reviewDays = new Set<string>();
  for (const r of reviews) {
    const d = new Date(r.reviewedAt);
    reviewDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  // 从今天向前数连续天数
  let streak = 0;
  const checkDate = new Date(now);
  // 如果今天还没复习，从昨天开始算
  const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
  if (!reviewDays.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 90; i++) {
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (reviewDays.has(key)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// 近 8 周每周趋势
async function getWeeklyTrend(
  userId: string,
  now: Date,
): Promise<{ label: string; knownRate: number; total: number }[]> {
  const trend: { label: string; knownRate: number; total: number }[] = [];

  for (let w = 7; w >= 0; w--) {
    const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    const reviews = await prisma.review.groupBy({
      by: ["reviewResult"],
      where: { userId, reviewedAt: { gte: weekStart, lte: weekEnd } },
      _count: { reviewResult: true },
    });

    const total = reviews.reduce((s, r) => s + r._count.reviewResult, 0);
    const known = reviews.find((r) => r.reviewResult === "known")?._count.reviewResult ?? 0;
    const knownRate = total > 0 ? Math.round((known / total) * 100) : -1;

    trend.push({
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      knownRate,
      total,
    });
  }

  return trend;
}
