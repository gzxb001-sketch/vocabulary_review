import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createInitialSchedule } from "@/lib/scheduler";
import { requireUserId, authError } from "@/lib/api-auth";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  const { id } = await params;

  try {
    // 查找该词的 reviewSchedule
    const schedule = await prisma.reviewSchedule.findFirst({
      where: { wordId: id, userId },
    });

    if (!schedule) {
      // 没有调度 → 创建一个初始调度，nextReviewAt = now（立刻到期）
      const init = createInitialSchedule();
      await prisma.reviewSchedule.create({
        data: {
          wordId: id,
          userId,
          nextReviewAt: new Date(), // 立即到期
          intervalDays: init.intervalDays,
          reviewCount: init.reviewCount,
          easeScore: init.easeScore,
          lastResult: init.lastResult,
        },
      });
    } else {
      // 已有调度 → 将 nextReviewAt 设为 now
      await prisma.reviewSchedule.update({
        where: { id: schedule.id },
        data: { nextReviewAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("review-now patch failed", error);
    return NextResponse.json({ message: "操作失败" }, { status: 500 });
  }
}
