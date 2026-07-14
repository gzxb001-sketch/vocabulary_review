import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildWordOrderBy, buildWordWhere, normalizeWordFilter, normalizeWordSort } from "@/lib/word-query";
import { requireUserId, authError } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const filter = normalizeWordFilter(searchParams.get("filter"));
    const sort = normalizeWordSort(searchParams.get("sort"));
    const where = { userId, ...buildWordWhere(q, filter) };
    const orderBy = buildWordOrderBy(sort);

    const items = await prisma.word.findMany({
      where,
      include: {
        schedule: { where: { userId } },
        sources: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy,
      take: 100,
    });

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        displayText: item.displayText,
        meaningZh: item.meaningZh,
        phonetic: item.phonetic,
        nextReviewAt: item.schedule?.nextReviewAt ?? null,
        sourceType: item.sources[0]?.sourceType ?? null,
      })),
    });
  } catch (error) {
    console.error("search words failed", error);
    return NextResponse.json({ message: "search failed" }, { status: 500 });
  }
}
