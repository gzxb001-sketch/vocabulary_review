import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromCookies } from "@/lib/auth";

/**
 * 校验 JWT 并确认用户真实存在后返回 userId，否则抛出 UNAUTHORIZED。
 *
 * JWT 是无状态的：用户被删除后其 cookie 仍然能通过签名校验。
 * 若只验签不查库，请求会以「幽灵用户」身份写入孤儿数据（远程库为手动
 * 迁移的历史 schema，无外键约束兜底），且 /api/auth/me 已把该用户视为
 * 游客——两层鉴权语义不一致会让用户以为保存成功，数据实际不可见。
 */
export async function requireUserId(): Promise<string> {
  const userId = await getUserIdFromCookies();
  if (!userId) throw new Error("UNAUTHORIZED");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new Error("UNAUTHORIZED");

  return userId;
}

export function authError(): NextResponse {
  return NextResponse.json({ message: "请先登录" }, { status: 401 });
}
