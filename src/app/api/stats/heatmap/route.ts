import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";
import { toDayKey } from "@/lib/stats";

// 返回近 ~91 天（含今天）每日复习次数，供打卡热力图使用
export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 90);

    const reviews = await prisma.review.findMany({
      where: { userId, reviewedAt: { gte: start } },
      select: { reviewedAt: true },
    });

    const days: Record<string, number> = {};
    for (const r of reviews) {
      const key = toDayKey(new Date(r.reviewedAt));
      days[key] = (days[key] || 0) + 1;
    }

    return NextResponse.json({ start: toDayKey(start), days });
  } catch (error) {
    console.error("heatmap fetch failed", error);
    return NextResponse.json({ start: "", days: {} }, { status: 500 });
  }
}
