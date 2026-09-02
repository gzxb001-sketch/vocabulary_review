import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "vocab-token";
export const EXPIRES_IN = "7d";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) return secret;
  // 生产环境必须显式配置密钥，绝不使用可预测的兜底值，否则任何人可伪造 token
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set. Configure it in production environment variables.");
  }
  // 仅本地开发使用固定密钥
  return "vocabulary-review-dev-secret";
}

export async function signToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(getJwtSecret());
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}
