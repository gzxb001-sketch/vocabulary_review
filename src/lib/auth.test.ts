import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { signToken, verifyToken } from "./auth";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-for-unit-tests";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("signToken / verifyToken", () => {
  it("签发后校验可还原 userId", async () => {
    const token = await signToken("user-123");
    expect(typeof token).toBe("string");
    expect(await verifyToken(token)).toBe("user-123");
  });

  it("非法 token → null（不抛错）", async () => {
    expect(await verifyToken("not-a-jwt")).toBeNull();
    expect(await verifyToken("")).toBeNull();
  });

  it("密钥变更后旧 token 校验失败 → null", async () => {
    const token = await signToken("user-123");
    process.env.JWT_SECRET = "another-secret";
    expect(await verifyToken(token)).toBeNull();
  });

  it("过期 token → null", async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const expired = await new SignJWT({ sub: "user-123" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret);
    expect(await verifyToken(expired)).toBeNull();
  });

  it("token 无 sub → null", async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const noSub = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
    expect(await verifyToken(noSub)).toBeNull();
  });
});

describe("生产环境密钥保护", () => {
  it("生产环境未配置 JWT_SECRET 时签发直接抛错，拒绝使用可预测兜底密钥", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.JWT_SECRET;
    await expect(signToken("user-123")).rejects.toThrow(/JWT_SECRET/);
  });
});
