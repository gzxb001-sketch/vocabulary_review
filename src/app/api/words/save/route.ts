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

      const existingWord = await prisma.word.findFirst({
        where: {
          OR: [
            ...(normalizedLemma ? [{ lemma: normalizedLemma }] : []),
            { displayText: normalizedDisplayText },
          ],
        },
      });

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

        // Add new meanings if provided
        if (item.meanings?.length) {
          const existingMeanings = await prisma.meaning.findMany({
            where: { wordId: existingWord.id },
            select: { meaningZh: true, partOfSpeech: true },
          });

          const existingSet = new Set(
            existingMeanings.map((m) => `${m.partOfSpeech}::${m.meaningZh}`)
          );

          const newMeanings = item.meanings
            .filter((m) => m.meaningZh && !existingSet.has(`${m.partOfSpeech}::${m.meaningZh}`))
            .map((m, i) => ({
              wordId: existingWord.id,
              partOfSpeech: m.partOfSpeech || "",
              meaningZh: m.meaningZh,
              exampleSentence: m.exampleSentence || null,
              exampleTranslation: m.exampleTranslation || null,
              isObscure: m.isObscure || false,
              isHighFreq: m.isHighFreq || false,
              sortOrder: existingMeanings.length + i,
            }));

          if (newMeanings.length > 0) {
            // Use individual create instead of createMany for Turso compatibility
            for (const m of newMeanings) {
              await prisma.meaning.create({ data: m });
            }
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

      // --- Create new word (sequential writes, no nested creates for Turso compat) ---

      const schedule = createInitialSchedule();

      // Step 1: Create the word
      const newWord = await prisma.word.create({
        data: {
          lemma: normalizedLemma || normalizedDisplayText.toLowerCase(),
          displayText: normalizedDisplayText,
          meaningZh: item.meaningZh,
          phonetic: item.phonetic,
          partOfSpeech: item.partOfSpeech,
          exampleSentence: item.exampleSentence,
          note: item.note,
        },
      });

      // Step 2: Create review schedule
      await prisma.reviewSchedule.create({
        data: {
          wordId: newWord.id,
          nextReviewAt: schedule.nextReviewAt,
          intervalDays: schedule.intervalDays,
          reviewCount: schedule.reviewCount,
          easeScore: schedule.easeScore,
          lastResult: schedule.lastResult,
        },
      });

      // Step 3: Create word source
      await prisma.wordSource.create({
        data: {
          wordId: newWord.id,
          sourceType: item.source.sourceType,
          sourceNote: item.source.sourceNote,
          sourceContext: item.source.sourceContext,
          imageId: item.source.imageId,
        },
      });

      // Step 4: Create meanings
      const meaningsToCreate = ((item.meanings || []).length > 0
        ? item.meanings!
        : item.partOfSpeech || item.meaningZh
          ? [{ partOfSpeech: item.partOfSpeech || "", meaningZh: item.meaningZh || "" }]
          : []
      ).filter((m) => m.meaningZh); // skip empty meanings

      for (let i = 0; i < meaningsToCreate.length; i++) {
        const m = meaningsToCreate[i];
        await prisma.meaning.create({
          data: {
            wordId: newWord.id,
            partOfSpeech: m.partOfSpeech || "",
            meaningZh: m.meaningZh,
            exampleSentence: m.exampleSentence || null,
            exampleTranslation: m.exampleTranslation || null,
            isObscure: m.isObscure || false,
            isHighFreq: m.isHighFreq || false,
            sortOrder: i,
          },
        });
      }

      saved += 1;
    }

    return NextResponse.json({ saved, duplicates });
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error("save words failed:", msg);
    return NextResponse.json(
      { message: "保存失败", detail: msg },
      { status: 500 }
    );
  }
}
