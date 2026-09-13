import { describe, it, expect, vi } from "vitest";

const { findMany, count, scheduleFindMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  scheduleFindMany: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { review: { findMany }, reviewSchedule: { count, findMany: scheduleFindMany } },
}));

import {
  calculateStreak,
  countMasteredWords,
  getReviewProgress,
  MASTERED_INTERVAL_DAYS,
  toDayKey,
  userDayStart,
} from "./stats";

const NOW = new Date(2026, 8, 2, 12, 0, 0); // 2026-09-02 12:00 本地时间

function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}

function mockReviews(days: number[]): void {
  findMany.mockResolvedValue(days.map((n) => ({ reviewedAt: daysAgo(n) })));
}

describe("toDayKey", () => {
  it("生成本地时区 YYYY-M-D 键（月/日不带前导零）", () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe("2026-0-5");
    expect(toDayKey(new Date(2026, 8, 2))).toBe("2026-8-2");
    expect(toDayKey(new Date(2026, 11, 31))).toBe("2026-11-31");
  });

  it("同一天不同时刻生成相同键", () => {
    expect(toDayKey(new Date(2026, 8, 2, 0, 5))).toBe(toDayKey(new Date(2026, 8, 2, 23, 59)));
  });
});

describe("userDayStart — 北京时区日边界", () => {
  it("北京 0-8 点的时刻，日起点是前一天北京 0 点（UTC 前一天 16:00）", () => {
    // 北京 2026-09-13 01:00 = UTC 2026-09-12 17:00
    const now = new Date("2026-09-12T17:00:00Z");
    expect(userDayStart(now).toISOString()).toBe("2026-09-12T16:00:00.000Z");
    // 历史格式：月份 0 基（9 月 = 8）
    expect(toDayKey(now)).toBe("2026-8-13");
  });

  it("北京白天的时刻正常落在当天", () => {
    // 北京 2026-09-13 11:00 = UTC 03:00
    const now = new Date("2026-09-13T03:00:00Z");
    expect(userDayStart(now).toISOString()).toBe("2026-09-12T16:00:00.000Z");
    expect(toDayKey(now)).toBe("2026-8-13");
  });
});

describe("getReviewProgress — 今日复习进度", () => {
  const CAPS = { newPerDay: 20, reviewPerDay: 100 };
  const NOW = new Date("2026-09-13T03:00:00Z");

  it("计划按日初到期口径封顶，已复习词按日初归属归还桶", async () => {
    // 当前到期：新词 3、旧词 40；今天已复习 5 个不同词，其中 2 个日初还是新词
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(40);
    findMany.mockResolvedValue([
      { wordId: "w1" },
      { wordId: "w2" },
      { wordId: "w3" },
      { wordId: "w4" },
      { wordId: "w5" },
    ]);
    scheduleFindMany.mockResolvedValue([
      { reviewCount: 1 },
      { reviewCount: 1 },
      { reviewCount: 2 },
      { reviewCount: 2 },
      { reviewCount: 3 },
    ]);
    const r = await getReviewProgress("u1", CAPS, NOW);
    // 日初口径：新词 3+2=5 → 封 5/20；旧词 40+3=43 → 封 43/100
    expect(r.dueNewNow).toBe(3);
    expect(r.dueReviewNow).toBe(40);
    expect(r.reviewedToday).toBe(5);
    expect(r.todayPlan).toBe(5 + 43);
  });

  it("reviewedToday 按 distinct wordId 计数，重学重复提交不虚增", async () => {
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(10);
    // 真实 Prisma 的 distinct: ["wordId"] 会在数据库层去重，mock 返回去重后的结果
    findMany.mockResolvedValue([{ wordId: "w1" }]);
    scheduleFindMany.mockResolvedValue([{ reviewCount: 3 }]);
    const r = await getReviewProgress("u1", CAPS, NOW);
    expect(findMany.mock.calls[0][0].distinct).toEqual(["wordId"]);
    expect(r.reviewedToday).toBe(1);
    expect(r.todayPlan).toBe(0 + 11);
  });

  it("到期超过配额时计划封顶", async () => {
    count.mockResolvedValueOnce(50).mockResolvedValueOnce(200);
    findMany.mockResolvedValue([]);
    scheduleFindMany.mockResolvedValue([]);
    const r = await getReviewProgress("u1", CAPS, NOW);
    expect(r.todayPlan).toBe(20 + 100);
  });
});

describe("calculateStreak", () => {
  it("今天+昨天+前天连续复习 → streak 为 3", async () => {
    mockReviews([0, 1, 2]);
    expect(await calculateStreak("u1", NOW)).toBe(3);
  });

  it("今天未复习，从昨天起连续 → 不因今天缺席而清零", async () => {
    mockReviews([1, 2]);
    expect(await calculateStreak("u1", NOW)).toBe(2);
  });

  it("今天复习但昨天缺席 → streak 仅含今天", async () => {
    mockReviews([0]);
    expect(await calculateStreak("u1", NOW)).toBe(1);
  });

  it("中间断档会截断连续计数", async () => {
    // 今天、昨天有，前天没有，大前天有 → 只数到昨天
    mockReviews([0, 1, 3, 4]);
    expect(await calculateStreak("u1", NOW)).toBe(2);
  });

  it("无任何复习记录 → 0", async () => {
    findMany.mockResolvedValue([]);
    expect(await calculateStreak("u1", NOW)).toBe(0);
  });

  it("同一天多条复习记录只算一天", async () => {
    mockReviews([0, 0, 0, 1]);
    expect(await calculateStreak("u1", NOW)).toBe(2);
  });
});

describe("countMasteredWords", () => {
  it("口径：间隔 >= 21 天且最近一次复习为认识", async () => {
    count.mockResolvedValue(327);
    const n = await countMasteredWords("u1");
    expect(n).toBe(327);
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        intervalDays: { gte: MASTERED_INTERVAL_DAYS },
        lastResult: "known",
      },
    });
  });

  it("最近一次是模糊/遗忘的词不算掌握（lastResult 过滤）", async () => {
    count.mockClear();
    count.mockResolvedValue(0);
    await countMasteredWords("u1");
    const arg = count.mock.calls[0][0];
    expect(arg.where.lastResult).toBe("known");
  });
});
