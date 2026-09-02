import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildWordOrderBy, buildWordWhere, normalizeWordFilter, normalizeWordSort, sortWordsByNextReview } from "@/lib/word-query";
import { requireUserId, authError } from "@/lib/api-auth";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parsePagination(searchParams: URLSearchParams): { limit: number; offset: number } {
  const limitRaw = Number.parseInt(searchParams.get("limit") || "", 10);
  const offsetRaw = Number.parseInt(searchParams.get("offset") || "", 10);

  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  return { limit, offset };
}

export async function GET(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const filter = normalizeWordFilter(searchParams.get("filter"));
    const sort = normalizeWordSort(searchParams.get("sort"));
    const { limit, offset } = parsePagination(searchParams);
    const where = { userId, ...buildWordWhere(q, filter) };
    const orderBy = buildWordOrderBy(sort);
    const isReviewAsc = sort === "review_asc";

    const include = {
      schedule: { where: { userId } },
      sources: { orderBy: { createdAt: "desc" } as const, take: 1 },
    };

    let items;
    let total: number;

    if (isReviewAsc) {
      // review_asc 需按一对多 schedule 的 nextReviewAt 排序，Prisma 无法对
      // to-many 关系子字段直接 orderBy，故先取回全部、应用层排序后分页。
      const all = await prisma.word.findMany({ where, include, orderBy });
      const ordered = sortWordsByNextReview(all);
      total = ordered.length;
      items = ordered.slice(offset, offset + limit);
    } else {
      const [list, count] = await Promise.all([
        prisma.word.findMany({ where, include, orderBy, skip: offset, take: limit }),
        prisma.word.count({ where }),
      ]);
      items = list;
      total = count;
    }

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        displayText: item.displayText,
        meaningZh: item.meaningZh,
        phonetic: item.phonetic,
        nextReviewAt: item.schedule[0]?.nextReviewAt ?? null,
        sourceType: item.sources[0]?.sourceType ?? null,
      })),
      total,
      hasMore: offset + items.length < total,
    });
  } catch (error) {
    console.error("search words failed", error);
    return NextResponse.json({ message: "search failed" }, { status: 500 });
  }
}
