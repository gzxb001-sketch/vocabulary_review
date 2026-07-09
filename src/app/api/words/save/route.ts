import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createInitialSchedule } from "@/lib/scheduler";

type SaveWordInput = {
  displayText: string;
  lemma: string;
  meaningZh?: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  note?: string;
  source: {
    sourceType: "exam" | "reading" | "lecture" | "manual" | "other";
    sourceNote?: string;
    sourceContext?: string;
    imageId?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: SaveWordInput[] = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "items is required" }, { status: 400 });
    }

    let saved = 0;
    let duplicates = 0;

    for (const item of items) {
      const normalizedLemma = item.lemma?.trim().toLowerCase();
      const normalizedDisplayText = item.displayText?.trim();

      if (!normalizedDisplayText) {
        continue;
      }

      let existingWord = normalizedLemma
        ? await prisma.word.findFirst({ where: { lemma: normalizedLemma } })
        : null;

      if (!existingWord) {
        existingWord = await prisma.word.findFirst({
          where: { displayText: normalizedDisplayText },
        });
      }

      if (existingWord) {
        duplicates += 1;

        await prisma.word.update({
          where: { id: existingWord.id },
          data: {
            meaningZh: existingWord.meaningZh || item.meaningZh,
            phonetic: existingWord.phonetic || item.phonetic,
            partOfSpeech: existingWord.partOfSpeech || item.partOfSpeech,
            exampleSentence: existingWord.exampleSentence || item.exampleSentence,
            note: existingWord.note || item.note,
          },
        });

        await prisma.wordSource.create({
          data: {
            wordId: existingWord.id,
            sourceType: item.source.sourceType,
            sourceNote: item.source.sourceNote,
            sourceContext: item.source.sourceContext,
            imageId: item.source.imageId,
          },
        });

        continue;
      }

      const schedule = createInitialSchedule();

      await prisma.word.create({
        data: {
          lemma: normalizedLemma || normalizedDisplayText.toLowerCase(),
          displayText: normalizedDisplayText,
          meaningZh: item.meaningZh,
          phonetic: item.phonetic,
          partOfSpeech: item.partOfSpeech,
          exampleSentence: item.exampleSentence,
          note: item.note,
          sources: {
            create: {
              sourceType: item.source.sourceType,
              sourceNote: item.source.sourceNote,
              sourceContext: item.source.sourceContext,
              imageId: item.source.imageId,
            },
          },
          schedule: {
            create: {
              nextReviewAt: schedule.nextReviewAt,
              intervalDays: schedule.intervalDays,
              reviewCount: schedule.reviewCount,
              easeScore: schedule.easeScore,
              lastResult: schedule.lastResult,
            },
          },
        },
      });

      saved += 1;
    }

    return NextResponse.json({ saved, duplicates });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "save failed" }, { status: 500 });
  }
}
