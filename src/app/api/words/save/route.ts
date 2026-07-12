import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createInitialSchedule } from "@/lib/scheduler";

type MeaningInput = {
  partOfSpeech: string;
  meaningZh: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  isObscure?: boolean;
  isHighFreq?: boolean;
};

type SaveWordInput = {
  displayText: string;
  lemma: string;
  meaningZh?: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  note?: string;
  meanings?: MeaningInput[];
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

      if (!normalizedDisplayText) continue;

      let existingWord = normalizedLemma
        ? await prisma.word.findFirst({ where: { lemma: normalizedLemma } })
        : null;

      if (!existingWord) {
        existingWord = await prisma.word.findFirst({ where: { displayText: normalizedDisplayText } });
      }

      if (existingWord) {
        duplicates += 1;

        // Update existing word
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

        // Add new meanings if provided and not already present
        if (item.meanings?.length) {
          const existingMeanings = await prisma.meaning.findMany({
            where: { wordId: existingWord.id },
            select: { meaningZh: true, partOfSpeech: true },
          });

          const existingSet = new Set(existingMeanings.map((m) => `${m.partOfSpeech}::${m.meaningZh}`));

          const newMeanings = item.meanings
            .filter((m) => !existingSet.has(`${m.partOfSpeech}::${m.meaningZh}`))
            .map((m, i) => ({
              wordId: existingWord!.id,
              partOfSpeech: m.partOfSpeech,
              meaningZh: m.meaningZh,
              exampleSentence: m.exampleSentence || null,
              isObscure: m.isObscure || false,
              sortOrder: existingMeanings.length + i,
            }));

          if (newMeanings.length > 0) {
            await prisma.meaning.createMany({ data: newMeanings });
          }
        }

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

      // Create new word
      const schedule = createInitialSchedule();

      const meaningsData = (item.meanings || []).map((m, i) => ({
        partOfSpeech: m.partOfSpeech,
        meaningZh: m.meaningZh,
        exampleSentence: m.exampleSentence || null,
        exampleTranslation: m.exampleTranslation || null,
        isObscure: m.isObscure || false,
        isHighFreq: m.isHighFreq || false,
        sortOrder: i,
      }));

      // Also create a fallback meaning from top-level fields if no meanings provided
      if (meaningsData.length === 0 && (item.partOfSpeech || item.meaningZh)) {
        meaningsData.push({
          partOfSpeech: item.partOfSpeech || "",
          meaningZh: item.meaningZh || "",
          exampleSentence: item.exampleSentence || null,
          exampleTranslation: null,
          isObscure: false,
          isHighFreq: false,
          sortOrder: 0,
        });
      }

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
          meanings: meaningsData.length > 0 ? { createMany: { data: meaningsData } } : undefined,
        },
      });

      saved += 1;
    }

    return NextResponse.json({ saved, duplicates });
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error("save words failed:", msg);
    return NextResponse.json(
      {
        message: "保存失败",
        detail: process.env.NODE_ENV === "development" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
