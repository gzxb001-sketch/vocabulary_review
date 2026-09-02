import { describe, it, expect, vi } from "vitest";

const { findMany, count } = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { review: { findMany }, reviewSchedule: { count } },
}));

import { calculateStreak, countMasteredWords, MASTERED_INTERVAL_DAYS, toDayKey } from "./stats";

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
