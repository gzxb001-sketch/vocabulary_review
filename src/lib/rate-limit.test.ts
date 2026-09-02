import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, clearRateLimit, getClientIp, __resetRateLimitForTest } from "./rate-limit";

beforeEach(() => {
  __resetRateLimitForTest();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("窗口内允许 max 次请求", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", { max: 3, windowMs: 60000 }).allowed).toBe(true);
    }
  });

  it("超过 max 后被拒绝并给出等待秒数", () => {
    for (let i = 0; i < 3; i++) {
      rateLimit("k", { max: 3, windowMs: 60000 });
    }
    const blocked = rateLimit("k", { max: 3, windowMs: 60000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("不同 key 互不影响", () => {
    rateLimit("a", { max: 1, windowMs: 60000 });
    expect(rateLimit("b", { max: 1, windowMs: 60000 }).allowed).toBe(true);
  });

  it("窗口过期后自动重置", () => {
    rateLimit("k", { max: 1, windowMs: 60000 });
    expect(rateLimit("k", { max: 1, windowMs: 60000 }).allowed).toBe(false);

    // 推进 61 秒
    vi.setSystemTime(new Date("2026-09-01T00:01:01Z"));
    expect(rateLimit("k", { max: 1, windowMs: 60000 }).allowed).toBe(true);
  });

  it("clearRateLimit 立即解除限制", () => {
    rateLimit("k", { max: 1, windowMs: 60000 });
    expect(rateLimit("k", { max: 1, windowMs: 60000 }).allowed).toBe(false);
    clearRateLimit("k");
    expect(rateLimit("k", { max: 1, windowMs: 60000 }).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("优先解析 x-forwarded-for 的第一个地址", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("回退到 x-real-ip，再回退到 unknown", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    expect(getClientIp(req)).toBe("198.51.100.2");
    expect(getClientIp(new Request("https://example.com"))).toBe("unknown");
  });
});
