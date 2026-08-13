import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";
import { REVIEW_CAPS } from "@/lib/review-config";

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  const now = new Date();

  const due = await prisma.reviewSchedule.findMany({
    where: { userId, nextReviewAt: { lte: now } },
    include: {
      word: {
        include: {
          sources: { orderBy: { createdAt: "desc" }, take: 1 },
          meanings: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
    orderBy: { nextReviewAt: "asc" },
  });

  // 新词（从未复习）按录入时间最早优先，受每日新词上限控制
  const newItems = due
    .filter((s) => s.reviewCount === 0)
    .sort((a, b) => a.word.createdAt.getTime() - b.word.createdAt.getTime())
    .slice(0, REVIEW_CAPS.newPerDay);

  // 旧债（复习过）按到期时间最久优先，受每日复习上限控制
  const reviewItems = due
    .filter((s) => s.reviewCount > 0)
    .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
    .slice(0, REVIEW_CAPS.reviewPerDay);

  const selected = [...newItems, ...reviewItems];

  return NextResponse.json({
    count: selected.length,
    totalDue: due.length,
    newCount: newItems.length,
    reviewCount: reviewItems.length,
    remainingDue: due.length - selected.length,
    caps: REVIEW_CAPS,
    items: selected.map((item) => ({
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
}

function parseSynonyms(note?: string | null): string[] {
  if (!note) return [];
  try {
    const parsed = JSON.parse(note);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) return parsed;
  } catch {}
  return [];
}
