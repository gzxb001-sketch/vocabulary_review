import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { calculateNextSchedule } from "@/lib/scheduler";
import { requireUserId, authError } from "@/lib/api-auth";

const requestSchema = z.object({
  wordId: z.string().min(1),
  // 服务端强制枚举：非法值若放行，scheduler 三个分支都不命中，
  // 会把 intervalDays 归零并把任意字符串写进 lastResult 污染调度数据
  result: z.enum(["known", "vague", "forgot"]),
  clientResultId: z.string().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "invalid params" }, { status: 400 });
    }
    const body = parsed.data;

    // 幂等保护：同一 clientResultId 的重复提交直接返回成功，不重复计分/推进调度
    if (body.clientResultId) {
      const existing = await prisma.review.findUnique({
        where: { clientResultId: body.clientResultId },
      });
      if (existing) {
        return NextResponse.json(
          { ok: true, duplicate: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    const schedule = await prisma.reviewSchedule.findFirst({
      where: { wordId: body.wordId, userId },
    });

    if (!schedule) {
      return NextResponse.json({ message: "schedule not found" }, { status: 404 });
    }

    const next = calculateNextSchedule(
      {
        intervalDays: schedule.intervalDays,
        reviewCount: schedule.reviewCount,
        easeScore: schedule.easeScore,
        lastResult: schedule.lastResult,
      },
      body.result,
    );

    await prisma.$transaction([
      prisma.review.create({
        data: {
          wordId: body.wordId,
          userId,
          reviewResult: body.result,
          intervalBefore: schedule.intervalDays,
          intervalAfter: next.intervalDays,
          clientResultId: body.clientResultId || null,
        },
      }),
      prisma.reviewSchedule.update({
        where: { id: schedule.id },
        data: {
          nextReviewAt: next.nextReviewAt,
          intervalDays: next.intervalDays,
          reviewCount: next.reviewCount,
          easeScore: next.easeScore,
          lastResult: next.lastResult,
        },
      }),
    ]);

    return NextResponse.json(
      { ok: true, schedule: next },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("review submit failed", error);
    return NextResponse.json({ message: "submit failed" }, { status: 500 });
  }
}
