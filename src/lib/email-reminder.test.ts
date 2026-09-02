import { describe, it, expect } from "vitest";
import {
  isUserDueForReminder,
  startOfShanghaiDay,
  shanghaiParts,
  type ReminderUser,
} from "./email-reminder";

// 上海时间 = UTC+8：2026-09-01T12:00:00Z 即上海 2026-09-01 20:00
const NOW = new Date("2026-09-01T12:00:00Z");

function user(
  hour: number,
  minute: number,
  emailLastSentAt: Date | null = null,
): ReminderUser {
  return { id: "u1", email: "u@test.dev", emailReminderHour: hour, emailReminderMinute: minute, emailLastSentAt };
}

describe("shanghaiParts / startOfShanghaiDay", () => {
  it("UTC 12:00 = 上海 20:00", () => {
    expect(shanghaiParts(NOW)).toEqual({ hour: 20, minute: 0 });
  });

  it("上海当天零点 = 前一日 UTC 16:00", () => {
    expect(startOfShanghaiDay(NOW).toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });
});

describe("isUserDueForReminder — 窗口匹配", () => {
  it("恰好到达设定时刻：待发送", () => {
    expect(isUserDueForReminder(user(20, 0), NOW)).toBe(true);
  });

  it("设定时刻之前 1 分钟：不发送", () => {
    const now = new Date("2026-09-01T11:59:00Z");
    expect(isUserDueForReminder(user(20, 0), now)).toBe(false);
  });

  it("错过精确分钟（20:05 才轮询）：仍会补发", () => {
    const now = new Date("2026-09-01T12:05:00Z");
    expect(isUserDueForReminder(user(20, 0), now)).toBe(true);
  });

  it("设定 00:00：当天任意时刻都已进入窗口", () => {
    expect(isUserDueForReminder(user(0, 0), NOW)).toBe(true);
  });
});

describe("isUserDueForReminder — 当日去重", () => {
  it("今天窗口内已发送（20:02 发，20:05 查）：不重发", () => {
    const now = new Date("2026-09-01T12:05:00Z");
    const u = user(20, 0, new Date("2026-09-01T12:02:00Z"));
    expect(isUserDueForReminder(u, now)).toBe(false);
  });

  it("昨天发过、今天窗口已到：再发（每天一封）", () => {
    const u = user(20, 0, new Date("2026-08-31T12:10:00Z"));
    expect(isUserDueForReminder(u, NOW)).toBe(true);
  });

  it("今天上海时间零点整发过：不重发（边界）", () => {
    const u = user(20, 0, new Date("2026-08-31T16:00:00Z"));
    expect(isUserDueForReminder(u, NOW)).toBe(false);
  });

  it("昨天深夜（上海 23:30）发过：今天窗口到点后重发", () => {
    const u = user(20, 0, new Date("2026-08-31T15:30:00Z"));
    expect(isUserDueForReminder(u, NOW)).toBe(true);
  });

  it("用户中途把提醒时间从 08:00 改到 20:00：当天已发过则不重发", () => {
    const u = user(20, 0, new Date("2026-09-01T00:00:00Z")); // 上海 08:00 发的
    expect(isUserDueForReminder(u, NOW)).toBe(false);
  });
});
