import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createInitialSchedule } from "@/lib/scheduler";
import { requireUserId, authError } from "@/lib/api-auth";

// 字段长度与条目数上限：本接口同时承接 OCR 批量、手动录入与 CSV 分块导入
// （客户端按 100 条分块），不设防的大请求会以 N+1 事务拖满 serverless 超时。
const requestSchema = z.object({
  items: z
    .array(
      z.object({
        displayText: z.string().min(1).max(100),
        lemma: z.string().max(100).optional(),
        meaningZh: z.string().max(500).optional(),
        phonetic: z.string().max(100).optional(),
        partOfSpeech: z.string().max(50).optional(),
        exampleSentence: z.string().max(1000).optional(),
        note: z.string().max(500).optional(),
        synonyms: z.array(z.string().min(1).max(50)).max(8).optional(),
        meanings: z
          .array(
            z.object({
              partOfSpeech: z.string().max(50),
              meaningZh: z.string().min(1).max(500),
              exampleSentence: z.string().max(1000).optional(),
              exampleTranslation: z.string().max(1000).optional(),
              isObscure: z.boolean().optional(),
              isHighFreq: z.boolean().optional(),
            }),
          )
          .max(10)
          .optional(),
        source: z.object({
          sourceType: z.enum(["exam", "reading", "lecture", "manual", "longSentence", "translation", "other"]),
          sourceNote: z.string().max(200).optional(),
          sourceContext: z.string().max(500).optional(),
          imageId: z.string().max(100).optional(),
        }),
      }),
    )
    .min(1)
    .max(100),
});

type SaveWordInput = z.infer<typeof requestSchema>["items"][number];

function encodeSynonyms(synonyms?: string[]): string | null {
  if (!synonyms?.length) return null;
  return JSON.stringify(synonyms);
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "invalid request body" }, { status: 400 });
    }
    const items: SaveWordInput[] = parsed.data.items;

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
