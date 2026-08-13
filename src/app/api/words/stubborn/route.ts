import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const items = await prisma.reviewSchedule.findMany({
      where: {
        userId,
        reviewCount: { gte: 2 },
        lastResult: { in: ["forgot", "vague"] },
      },
      include: {
        word: {
          select: {
            id: true,
            displayText: true,
            meaningZh: true,
            phonetic: true,
          },
        },
        reviews: {
          orderBy: { reviewedAt: "desc" },
          take: 5,
          select: { reviewResult: true },
        },
      },
      orderBy: [{ easeScore: "asc" }, { reviewCount: "desc" }],
      take: 30,
    });

    return NextResponse.json({
      items: items.map((item) => ({
        wordId: item.wordId,
        displayText: item.word.displayText,
        meaningZh: item.word.meaningZh,
        phonetic: item.word.phonetic,
        reviewCount: item.reviewCount,
        easeScore: item.easeScore,
        lastResult: item.lastResult,
        nextReviewAt: item.nextReviewAt,
        recentResults: item.reviews.map((r) => r.reviewResult),
      })),
    });
  } catch (error) {
    console.error("stubborn words fetch failed", error);
    return NextResponse.json({ items: [] });
  }
}
