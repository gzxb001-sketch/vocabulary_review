import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateNextSchedule } from "@/lib/scheduler";
import { requireUserId, authError } from "@/lib/api-auth";

type SubmitBody = {
  wordId: string;
  result: "known" | "vague" | "forgot";
};

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const body: SubmitBody = await req.json();

    if (!body.wordId || !body.result) {
      return NextResponse.json({ message: "invalid params" }, { status: 400 });
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

    await Promise.all([
      prisma.review.create({
        data: {
          wordId: body.wordId,
          userId,
          reviewResult: body.result,
          intervalBefore: schedule.intervalDays,
          intervalAfter: next.intervalDays,
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

    return NextResponse.json({ ok: true, schedule: next });
  } catch (error) {
    console.error("review submit failed", error);
    return NextResponse.json({ message: "submit failed" }, { status: 500 });
  }
}
