import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";

// 专项攻克队列：只返回用户反复记不住的顽固词，作为一次独立的复习会话。
// 顽固词定义与 /api/words/stubborn 保持一致：复习 ≥2 次且最近一次为「模糊/不会」。
// 答题走同一个 /api/review/submit，SRS 正常推进——攻克本身就是在修正难度系数。
const ATTACK_SESSION_SIZE = 20;

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const due = await prisma.reviewSchedule.findMany({
      where: {
        userId,
        reviewCount: { gte: 2 },
        lastResult: { in: ["forgot", "vague"] },
      },
      include: {
        word: {
          include: {
            sources: { orderBy: { createdAt: "desc" }, take: 1 },
            meanings: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
      orderBy: [{ easeScore: "asc" }, { reviewCount: "desc" }],
      take: ATTACK_SESSION_SIZE,
    });

    return NextResponse.json({
      count: due.length,
      items: due.map((item) => ({
        wordId: item.wordId,
        displayText: item.word.displayText,
        meaningZh: item.word.meaningZh,
        phonetic: item.word.phonetic,
        exampleSentence: item.word.exampleSentence,
        sourceType: item.word.sources[0]?.sourceType ?? null,
        sourceNote: item.word.sources[0]?.sourceNote ?? null,
        sourceContext: item.word.sources[0]?.sourceContext ?? null,
        synonyms: parseSynonyms(item.word.note),
        meanings: item.word.meanings.map((m) => ({
          partOfSpeech: m.partOfSpeech,
          meaningZh: m.meaningZh,
          exampleSentence: m.exampleSentence,
          exampleTranslation: m.exampleTranslation,
          isObscure: m.isObscure,
          isHighFreq: m.isHighFreq,
        })),
      })),
    });
  } catch (error) {
    console.error("stubborn review queue fetch failed", error);
    return NextResponse.json({ count: 0, items: [] });
  }
}

function parseSynonyms(note?: string | null): string[] {
  if (!note) return [];
  try {
    const parsed = JSON.parse(note);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) return parsed;
  } catch {}
  return [];
}
