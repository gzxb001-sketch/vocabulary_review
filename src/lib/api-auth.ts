import { NextResponse } from "next/server";
import { getUserIdFromCookies } from "@/lib/auth";

export async function requireUserId(): Promise<string> {
  const userId = await getUserIdFromCookies();
  if (!userId) throw new Error("UNAUTHORIZED");
  return userId;
}

export function authError(): NextResponse {
  return NextResponse.json({ message: "请先登录" }, { status: 401 });
}
