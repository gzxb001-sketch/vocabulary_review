import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createInitialSchedule } from "@/lib/scheduler";
import { requireUserId, authError } from "@/lib/api-auth";

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
  synonyms?: string[];
  meanings?: MeaningInput[];
  source: {
    sourceType: "exam" | "reading" | "lecture" | "manual" | "other";
    sourceNote?: string;
    sourceContext?: string;
    imageId?: string;
  };
};

function encodeSynonyms(synonyms?: string[]): string | null {
  if (!synonyms?.length) return null;
  return JSON.stringify(synonyms);
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

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
          userId,
          OR: [
            ...(normalizedLemma ? [{ lemma: normalizedLemma }] : []),
            { displayText: normalizedDisplayText },
          ],
        },
      });

      if (existingWord) {
        duplicates += 1;

        // 收集新义项
        const existingMeanings = await prisma.meaning.findMany({
          where: { wordId: existingWord.id, userId },
          select: { meaningZh: true, partOfSpeech: true },
        });

        const existingSet = new Set(
          existingMeanings.map((m) => `${m.partOfSpeech}::${m.meaningZh}`)
        );

        const newMeaningsData = (item.meanings || [])
          .filter((m) => m.meaningZh && !existingSet.has(`${m.partOfSpeech}::${m.meaningZh}`))
          .map((m, i) => ({
            wordId: existingWord.id,
            userId,
            partOfSpeech: m.partOfSpeech || "",
            meaningZh: m.meaningZh,
            exampleSentence: m.exampleSentence || null,
            exampleTranslation: m.exampleTranslation || null,
            isObscure: m.isObscure || false,
            isHighFreq: m.isHighFreq || false,
            sortOrder: existingMeanings.length + i,
          }));

        // 批量写入：合并 word.update + source.create + meaning creates
        const synNote = encodeSynonyms(item.synonyms);
        await prisma.$transaction([
          prisma.word.update({
            where: { id: existingWord.id },
            data: {
              meaningZh: existingWord.meaningZh || item.meaningZh,
              phonetic: existingWord.phonetic || item.phonetic,
              partOfSpeech: existingWord.partOfSpeech || item.partOfSpeech,
              exampleSentence: existingWord.exampleSentence || item.exampleSentence,
              note: synNote || existingWord.note || item.note,
            },
          }),
          prisma.wordSource.create({
            data: {
              wordId: existingWord.id,
              userId,
              sourceType: item.source.sourceType,
              sourceNote: item.source.sourceNote,
              sourceContext: item.source.sourceContext,
            },
          }),
          ...newMeaningsData.map((m) => prisma.meaning.create({ data: m })),
        ]);

        continue;
      }

      // --- Create new word（批量写入：word + schedule + source + meanings 合并到一个事务） ---

      const schedule = createInitialSchedule();

      const meaningsToCreate = ((item.meanings || []).length > 0
        ? item.meanings!
        : item.partOfSpeech || item.meaningZh
          ? [{ partOfSpeech: item.partOfSpeech || "", meaningZh: item.meaningZh || "" }]
          : []
      ).filter((m) => m.meaningZh);

      const newWordId = crypto.randomUUID();
      const synNote = encodeSynonyms(item.synonyms);

      await prisma.$transaction([
        prisma.word.create({
          data: {
            id: newWordId,
            userId,
            lemma: normalizedLemma || normalizedDisplayText.toLowerCase(),
            displayText: normalizedDisplayText,
            meaningZh: item.meaningZh,
            phonetic: item.phonetic,
            partOfSpeech: item.partOfSpeech,
            exampleSentence: item.exampleSentence,
            note: synNote || item.note,
          },
        }),
        prisma.reviewSchedule.create({
          data: {
            wordId: newWordId,
            userId,
            nextReviewAt: schedule.nextReviewAt,
            intervalDays: schedule.intervalDays,
            reviewCount: schedule.reviewCount,
            easeScore: schedule.easeScore,
            lastResult: schedule.lastResult,
          },
        }),
        prisma.wordSource.create({
          data: {
            wordId: newWordId,
            userId,
            sourceType: item.source.sourceType,
            sourceNote: item.source.sourceNote,
            sourceContext: item.source.sourceContext,
          },
        }),
        ...meaningsToCreate.map((m, i) =>
          prisma.meaning.create({
            data: {
              wordId: newWordId,
              userId,
              partOfSpeech: m.partOfSpeech || "",
              meaningZh: m.meaningZh,
              exampleSentence: m.exampleSentence || null,
              exampleTranslation: m.exampleTranslation || null,
              isObscure: m.isObscure || false,
              isHighFreq: m.isHighFreq || false,
              sortOrder: i,
            },
          })
        ),
      ]);

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
