import { describe, it, expect } from "vitest";
import { getSprintInfo, daysUntilExam } from "./sprint";

const NOW = new Date("2026-09-01T12:00:00Z");

function examInDays(days: number): Date {
  return new Date(NOW.getTime() + days * 86400000);
}

describe("daysUntilExam", () => {
  it("当天考试为 0，按自然日取整", () => {
    expect(daysUntilExam(new Date("2026-09-01T00:00:00Z"), NOW)).toBe(0);
    // 不足一天的余数向下取整（自然日差）
    expect(daysUntilExam(new Date("2026-09-05T23:00:00Z"), NOW)).toBe(4);
  });
});

describe("getSprintInfo — 阶段边界", () => {
  it("未设置考试日期：常规节奏，daysLeft 为 null", () => {
    const info = getSprintInfo(null, NOW);
    expect(info.phase).toBe("regular");
    expect(info.daysLeft).toBeNull();
    expect(info.caps).toEqual({ newPerDay: 20, reviewPerDay: 100 });
  });

  it("日期已过期：回退常规节奏", () => {
    const info = getSprintInfo(examInDays(-1), NOW);
    expect(info.phase).toBe("regular");
    expect(info.daysLeft).toBeNull();
  });

  it("剩余 121 天：常规节奏", () => {
    const info = getSprintInfo(examInDays(121), NOW);
    expect(info.phase).toBe("regular");
    expect(info.caps).toEqual({ newPerDay: 20, reviewPerDay: 100 });
  });

  it("剩余 120 天：进入强化期（30 新词 / 150 复习）", () => {
    const info = getSprintInfo(examInDays(120), NOW);
    expect(info.phase).toBe("strengthen");
    expect(info.daysLeft).toBe(120);
    expect(info.caps).toEqual({ newPerDay: 30, reviewPerDay: 150 });
  });

  it("剩余 15 天：仍是强化期", () => {
    const info = getSprintInfo(examInDays(15), NOW);
    expect(info.phase).toBe("strengthen");
  });

  it("剩余 14 天：进入冲刺期，新词归零", () => {
    const info = getSprintInfo(examInDays(14), NOW);
    expect(info.phase).toBe("sprint");
    expect(info.caps).toEqual({ newPerDay: 0, reviewPerDay: 200 });
  });

  it("剩余 4 天：仍是冲刺期", () => {
    const info = getSprintInfo(examInDays(4), NOW);
    expect(info.phase).toBe("sprint");
  });

  it("剩余 3 天：考前收敛", () => {
    const info = getSprintInfo(examInDays(3), NOW);
    expect(info.phase).toBe("final");
    expect(info.caps).toEqual({ newPerDay: 0, reviewPerDay: 200 });
  });

  it("考试当天：考前收敛，daysLeft 为 0", () => {
    const info = getSprintInfo(examInDays(0), NOW);
    expect(info.phase).toBe("final");
    expect(info.daysLeft).toBe(0);
  });
});
