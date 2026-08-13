import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createInitialSchedule } from "@/lib/scheduler";
import { requireUserId, authError } from "@/lib/api-auth";
import { KAOYAN_WORD_MAP } from "@/lib/kaoyan-words";

export async function POST() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    // 查询用户已有的所有 lemma
    const existingWords = await prisma.word.findMany({
      where: { userId },
      select: { lemma: true, id: true },
    });
    const existingLemmas = new Set(existingWords.map((w) => w.lemma.toLowerCase()));
    const wordIdByLemma = new Map(existingWords.map((w) => [w.lemma.toLowerCase(), w.id]));

    let imported = 0;
    let skipped = 0;

    for (const [lemma, entry] of Object.entries(KAOYAN_WORD_MAP)) {
      const normalizedLemma = lemma.toLowerCase();

      if (existingLemmas.has(normalizedLemma)) {
        // 已存在：只追加新义项
        const existingId = wordIdByLemma.get(normalizedLemma);
        if (existingId) {
          const existingMeanings = await prisma.meaning.findMany({
            where: { wordId: existingId, userId },
            select: { meaningZh: true, partOfSpeech: true },
          });
          const existingSet = new Set(
            existingMeanings.map((m) => `${m.partOfSpeech}::${m.meaningZh}`)
          );
          const newMeanings = entry.meanings
            .filter((m) => !existingSet.has(`${m.partOfSpeech}::${m.meaningZh}`))
            .map((m, i) => ({
              wordId: existingId,
              userId,
              partOfSpeech: m.partOfSpeech,
              meaningZh: m.meaningZh,
              exampleSentence: m.exampleSentence || null,
              exampleTranslation: m.exampleTranslation || null,
              isObscure: m.isObscure,
              isHighFreq: m.isHighFreq,
              sortOrder: existingMeanings.length + i,
            }));

          if (newMeanings.length > 0) {
            await Promise.all(newMeanings.map((m) => prisma.meaning.create({ data: m })));
            imported++;
          } else {
            skipped++;
          }
        }
        continue;
      }

      // 新词：创建 Word + ReviewSchedule + Meanings + WordSource
      const schedule = createInitialSchedule();
      const newWordId = crypto.randomUUID();
      const displayText = lemma.charAt(0).toUpperCase() + lemma.slice(1);
      const firstMeaning = entry.meanings[0];

      await prisma.$transaction([
        prisma.word.create({
          data: {
            id: newWordId,
            userId,
            lemma: normalizedLemma,
            displayText,
            meaningZh: firstMeaning?.meaningZh || "",
            phonetic: entry.phonetic || "",
            partOfSpeech: firstMeaning?.partOfSpeech || "",
            exampleSentence: firstMeaning?.exampleSentence || "",
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
            sourceType: "exam",
            sourceNote: "考研核心词一键导入",
          },
        }),
        ...entry.meanings.map((m, i) =>
          prisma.meaning.create({
            data: {
              wordId: newWordId,
              userId,
              partOfSpeech: m.partOfSpeech,
              meaningZh: m.meaningZh,
              exampleSentence: m.exampleSentence || null,
              exampleTranslation: m.exampleTranslation || null,
              isObscure: m.isObscure,
              isHighFreq: m.isHighFreq,
              sortOrder: i,
            },
          })
        ),
      ]);

      imported++;
    }

    // 新词需要重新安排复习时间：将 nextReviewAt 设为当前时间
    //（后续可在复习时自然触发）

    return NextResponse.json({ imported, skipped });
  } catch (error) {
    console.error("import kaoyan words failed", error);
    return NextResponse.json({ message: "导入失败，请稍后重试" }, { status: 500 });
  }
}
