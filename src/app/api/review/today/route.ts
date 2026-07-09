import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const now = new Date();

  const items = await prisma.reviewSchedule.findMany({
    where: {
      nextReviewAt: {
        lte: now,
      },
    },
    include: {
      word: {
        include: {
          sources: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      nextReviewAt: "asc",
    },
    take: 50,
  });

  return NextResponse.json({
    count: items.length,
    items: items.map((item) => ({
      wordId: item.wordId,
      displayText: item.word.displayText,
      meaningZh: item.word.meaningZh,
      phonetic: item.word.phonetic,
      exampleSentence: item.word.exampleSentence,
      sourceType: item.word.sources[0]?.sourceType ?? null,
      sourceNote: item.word.sources[0]?.sourceNote ?? null,
    })),
  });
}
