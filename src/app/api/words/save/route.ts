import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
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

    // —— 批量化：把逐词 N+1 往返（每词 ≈7 次 Turso 往返，30 词 ≈ 15 秒）
    //    压成「1 次查重 + 1 个事务批量写」——30 词从 15 秒降到 1 秒级 ——

    // 1. 规范化 + 组内去重（同批重复词合并为一次入库，来源各记一条）
    type Norm = SaveWordInput & {
      displayText: string;
      lemma: string;
      __dupSources: SaveWordInput["source"][];
      __dupMeanings: NonNullable<SaveWordInput["meanings"]>;
    };
    const norms: Norm[] = [];
    const seen = new Map<string, Norm>();
    for (const item of items) {
      const displayText = item.displayText.trim();
      if (!displayText) continue;
      const lemma = item.lemma?.trim().toLowerCase() || displayText.toLowerCase();
      const key = byLemmaKey(lemma, displayText);
      const prev = seen.get(key);
      if (prev) {
        prev.__dupSources.push(item.source);
        prev.__dupMeanings.push(...(item.meanings ?? []));
        continue;
      }
      const norm: Norm & { __dupSources: SaveWordInput["source"][]; __dupMeanings: NonNullable<SaveWordInput["meanings"]> } = {
        ...item, displayText, lemma,
        __dupSources: [item.source],
        __dupMeanings: [...(item.meanings ?? [])],
      };
      seen.set(key, norm);
      norms.push(norm);
    }

    // 2. 一次查重（含现有义项，供合并去重）
    const lemmas = [...new Set(norms.map((n) => n.lemma))];
    const displayTexts = [...new Set(norms.map((n) => n.displayText))];
    const existingWords = await prisma.word.findMany({
      where: { userId, OR: [{ lemma: { in: lemmas } }, { displayText: { in: displayTexts } }] },
      include: { meanings: { orderBy: { sortOrder: "asc" } } },
    });
    const byLemma = new Map(existingWords.map((w) => [w.lemma, w]));
    const byDisplay = new Map(existingWords.map((w) => [w.displayText, w]));

    // 3. 分组：新建行 vs 已存在词的更新操作
    let saved = 0;
    let duplicates = 0;
    const newWordRows: Array<Record<string, unknown>> = [];
    const newScheduleRows: Array<Record<string, unknown>> = [];
    const newSourceRows: Array<Record<string, unknown>> = [];
    const newMeaningRows: Array<Record<string, unknown>> = [];
    const wordUpdateOps: Prisma.PrismaPromise<unknown>[] = [];

    for (const n of norms) {
      const existing = byLemma.get(n.lemma) ?? byDisplay.get(n.displayText) ?? null;

      if (existing) {
        duplicates += 1;
        // 义项合并（去重）+ 来源追加 + 词字段仅填空
        const existingSet = new Set(existing.meanings.map((m) => `${m.partOfSpeech}::${m.meaningZh}`));
        const freshMeanings = n.__dupMeanings
          .filter((m) => m.meaningZh && !existingSet.has(`${m.partOfSpeech || ""}::${m.meaningZh}`))
          .map((m, i) => ({
            wordId: existing.id,
            userId,
            partOfSpeech: m.partOfSpeech || "",
            meaningZh: m.meaningZh,
            exampleSentence: m.exampleSentence || null,
            exampleTranslation: m.exampleTranslation || null,
            isObscure: m.isObscure || false,
            isHighFreq: m.isHighFreq || false,
            sortOrder: existing.meanings.length + i,
          }));
        newMeaningRows.push(...freshMeanings);
        for (const src of n.__dupSources) {
          newSourceRows.push({ wordId: existing.id, userId, sourceType: src.sourceType, sourceNote: src.sourceNote ?? null, sourceContext: src.sourceContext ?? null });
        }
        // 仅填空语义：字段已有值则无需更新——大多数重复保存可跳过这条 update
        const needsWordUpdate =
          (!existing.meaningZh && !!n.meaningZh) ||
          (!existing.phonetic && !!n.phonetic) ||
          (!existing.partOfSpeech && !!n.partOfSpeech) ||
          (!existing.exampleSentence && !!n.exampleSentence);
        if (needsWordUpdate) {
          wordUpdateOps.push(
            prisma.word.update({
              where: { id: existing.id },
              data: {
                meaningZh: existing.meaningZh || n.meaningZh,
                phonetic: existing.phonetic || n.phonetic,
                partOfSpeech: existing.partOfSpeech || n.partOfSpeech,
                exampleSentence: existing.exampleSentence || n.exampleSentence,
              },
            }),
          );
        }
        continue;
      }

      // 新词行
      saved += 1;
      const wordId = crypto.randomUUID();
      const schedule = createInitialSchedule();
      const synNote = encodeSynonyms(n.synonyms);
      const meaningsToCreate = ((n.meanings || []).length > 0
        ? n.meanings!
        : n.partOfSpeech || n.meaningZh
          ? [{ partOfSpeech: n.partOfSpeech || "", meaningZh: n.meaningZh || "" }]
          : []
      ).filter((m) => m.meaningZh);

      newWordRows.push({
        id: wordId,
        userId,
        lemma: n.lemma,
        displayText: n.displayText,
        meaningZh: n.meaningZh,
        phonetic: n.phonetic,
        partOfSpeech: n.partOfSpeech,
        exampleSentence: n.exampleSentence,
        note: synNote || n.note,
      });
      newScheduleRows.push({
        wordId,
        userId,
        nextReviewAt: schedule.nextReviewAt,
        intervalDays: schedule.intervalDays,
        reviewCount: schedule.reviewCount,
        easeScore: schedule.easeScore,
        lastResult: schedule.lastResult,
      });
      for (const src of n.__dupSources) {
        newSourceRows.push({ wordId, userId, sourceType: src.sourceType, sourceNote: src.sourceNote ?? null, sourceContext: src.sourceContext ?? null });
      }
      meaningsToCreate.forEach((m, i) => {
        newMeaningRows.push({
          wordId,
          userId,
          partOfSpeech: m.partOfSpeech || "",
          meaningZh: m.meaningZh,
          exampleSentence: m.exampleSentence || null,
          exampleTranslation: m.exampleTranslation || null,
          isObscure: m.isObscure || false,
          isHighFreq: m.isHighFreq || false,
          sortOrder: i,
        });
      });
    }

    // 4. 单事务批量写：语句数 ≈ 常量级（不再随词数增长）
    await prisma.$transaction([
      prisma.word.createMany({ data: newWordRows as never }),
      prisma.reviewSchedule.createMany({ data: newScheduleRows as never }),
      prisma.wordSource.createMany({ data: newSourceRows as never }),
      prisma.meaning.createMany({ data: newMeaningRows as never }),
      ...wordUpdateOps,
    ]);

    return NextResponse.json({ saved, duplicates });
  } catch (error: any) {
    // 详情只进服务端日志：原始错误可能携带 Prisma/数据库内部信息，不透传客户端
    console.error("save words failed:", error?.message || String(error));
    return NextResponse.json(
      { message: "保存失败" },
      { status: 500 }
    );
  }
}

/** 组内去重键：lemma 与 displayText 任一命中即视为同词（与查重逻辑一致） */
function byLemmaKey(lemma: string, displayText: string): string {
  return lemma || displayText.toLowerCase();
}
