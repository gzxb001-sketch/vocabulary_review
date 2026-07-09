import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateNextSchedule } from "@/lib/scheduler";

type SubmitBody = {
  wordId: string;
  result: "known" | "vague" | "forgot";
};

export async function POST(req: NextRequest) {
  try {
    const body: SubmitBody = await req.json();

    if (!body.wordId || !body.result) {
      return NextResponse.json({ message: "invalid params" }, { status: 400 });
    }

    const schedule = await prisma.reviewSchedule.findUnique({
      where: { wordId: body.wordId },
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
          reviewResult: body.result,
          intervalBefore: schedule.intervalDays,
          intervalAfter: next.intervalDays,
        },
      }),
      prisma.reviewSchedule.update({
        where: { wordId: body.wordId },
        data: {
          nextReviewAt: next.nextReviewAt,
          intervalDays: next.intervalDays,
          reviewCount: next.reviewCount,
          easeScore: next.easeScore,
          lastResult: next.lastResult,
        },
      }),
    ]);

    return NextResponse.json(next);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "submit failed" }, { status: 500 });
  }
}
