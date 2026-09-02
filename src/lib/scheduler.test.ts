import { describe, it, expect } from "vitest";
import { calculateNextSchedule, createInitialSchedule } from "./scheduler";

describe("createInitialSchedule", () => {
  it("返回 SM-2 初始状态：interval 0 / reviewCount 0 / ease 2.5", () => {
    const s = createInitialSchedule(new Date("2026-09-01T00:00:00Z"));
    expect(s.intervalDays).toBe(0);
    expect(s.reviewCount).toBe(0);
    expect(s.easeScore).toBe(2.5);
    expect(s.lastResult).toBe("vague");
  });
});

describe("calculateNextSchedule — known", () => {
  it("首次认识（新词）：interval 0 → 2 天，先跨过遗忘曲线最陡的 48 小时", () => {
    const next = calculateNextSchedule(
      { intervalDays: 0, reviewCount: 0, easeScore: 2.5 },
      "known",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.intervalDays).toBe(2);
    expect(next.reviewCount).toBe(1);
  });

  it("昨天忘了、今天答对（interval 1）→ 4 天，不再直接跳 7 天", () => {
    const next = calculateNextSchedule(
      { intervalDays: 1, reviewCount: 1, easeScore: 2.3 },
      "known",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.intervalDays).toBe(4);
  });

  it("间隔 2：跳到 7 天", () => {
    const next = calculateNextSchedule(
      { intervalDays: 2, reviewCount: 1, easeScore: 2.5 },
      "known",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.intervalDays).toBe(7);
  });

  it("间隔 3：仍走固定阶梯 → 7 天", () => {
    const next = calculateNextSchedule(
      { intervalDays: 3, reviewCount: 2, easeScore: 2.5 },
      "known",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.intervalDays).toBe(7);
  });

  it("间隔 ≥4：按 interval * ease 增长", () => {
    const next = calculateNextSchedule(
      { intervalDays: 4, reviewCount: 1, easeScore: 2.5 },
      "known",
      new Date("2026-09-01T00:00:00Z"),
    );
    // round(4 * 2.5) = 10
    expect(next.intervalDays).toBe(10);
  });

  it("连续认识的爬升链：2 → 7 → ease 递增；4 天档位由遗忘恢复路径（interval 1 → 4）覆盖", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    let state = { intervalDays: 0, reviewCount: 0, easeScore: 2.5 };
    const ladder: number[] = [];

    for (let i = 0; i < 3; i++) {
      const next = calculateNextSchedule(state, "known", now);
      ladder.push(next.intervalDays);
      state = {
        intervalDays: next.intervalDays,
        reviewCount: next.reviewCount,
        easeScore: next.easeScore,
      };
    }

    // 2 → 7 → round(7 * 2.6) = 18
    expect(ladder).toEqual([2, 7, 18]);
    expect(state.reviewCount).toBe(3);
  });

  it("认识会提高 ease（上限 3.2）", () => {
    const next = calculateNextSchedule(
      { intervalDays: 4, reviewCount: 1, easeScore: 3.2 },
      "known",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.easeScore).toBe(3.2);
  });
});

describe("calculateNextSchedule — vague", () => {
  it("首次模糊（interval ≤1）：2 天", () => {
    const next = calculateNextSchedule(
      { intervalDays: 0, reviewCount: 0, easeScore: 2.5 },
      "vague",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.intervalDays).toBe(2);
  });

  it("已有间隔：按 1.5 倍增长", () => {
    const next = calculateNextSchedule(
      { intervalDays: 4, reviewCount: 1, easeScore: 2.5 },
      "vague",
      new Date("2026-09-01T00:00:00Z"),
    );
    // round(4 * 1.5) = 6
    expect(next.intervalDays).toBe(6);
  });

  it("模糊轻微降低 ease", () => {
    const next = calculateNextSchedule(
      { intervalDays: 4, reviewCount: 1, easeScore: 2.5 },
      "vague",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.easeScore).toBeCloseTo(2.45, 2);
  });
});

describe("calculateNextSchedule — forgot", () => {
  it("遗忘：间隔重置为 1 天", () => {
    const next = calculateNextSchedule(
      { intervalDays: 10, reviewCount: 3, easeScore: 2.5 },
      "forgot",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.intervalDays).toBe(1);
  });

  it("遗忘降低 ease（下限 1.3）", () => {
    const next = calculateNextSchedule(
      { intervalDays: 10, reviewCount: 3, easeScore: 1.3 },
      "forgot",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.easeScore).toBe(1.3);
  });
});

describe("calculateNextSchedule — nextReviewAt", () => {
  it("下一次复习时间 = 当前时间 + 间隔天数", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const next = calculateNextSchedule(
      { intervalDays: 0, reviewCount: 0, easeScore: 2.5 },
      "known",
      now,
    );
    expect(next.nextReviewAt.getTime()).toBe(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  });
});

describe("calculateNextSchedule — 防御性入参", () => {
  it("负数 interval / reviewCount 会被钳制为 0", () => {
    const next = calculateNextSchedule(
      { intervalDays: -5, reviewCount: -1, easeScore: 2.5 },
      "vague",
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(next.intervalDays).toBe(2);
    expect(next.reviewCount).toBe(1);
  });
});
