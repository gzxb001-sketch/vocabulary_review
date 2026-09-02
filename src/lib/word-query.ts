import { Prisma, SourceType } from "@prisma/client";

export const SOURCE_FILTERS = ["exam", "reading", "lecture", "manual", "longSentence", "translation", "other"] as const;
export const WORD_SORTS = ["created_desc", "created_asc", "review_asc", "alpha_asc"] as const;

export type WordFilter = "all" | "due" | (typeof SOURCE_FILTERS)[number];
export type WordSort = (typeof WORD_SORTS)[number];

export function normalizeWordFilter(value?: string | null): WordFilter {
  const normalized = (value || "all").trim();

  if (normalized === "all" || normalized === "due") {
    return normalized;
  }

  if (SOURCE_FILTERS.includes(normalized as (typeof SOURCE_FILTERS)[number])) {
    return normalized as (typeof SOURCE_FILTERS)[number];
  }

  return "all";
}

export function normalizeWordSort(value?: string | null): WordSort {
  const normalized = (value || "created_desc").trim();

  if (WORD_SORTS.includes(normalized as WordSort)) {
    return normalized as WordSort;
  }

  return "created_desc";
}

export function buildWordWhere(q: string, filter: WordFilter): Prisma.WordWhereInput {
  const now = new Date();

  return {
    ...(q
      ? {
          OR: [
            {
              displayText: {
                contains: q,
              },
            },
            {
              lemma: {
                contains: q.toLowerCase(),
              },
            },
            {
              meaningZh: {
                contains: q,
              },
            },
          ],
        }
      : {}),
    ...(filter === "due"
      ? {
          schedule: {
            some: {
              nextReviewAt: {
                lte: now,
              },
            },
          },
        }
      : {}),
    ...(SOURCE_FILTERS.includes(filter as (typeof SOURCE_FILTERS)[number])
      ? {
          sources: {
            some: {
              sourceType: filter as SourceType,
            },
          },
        }
      : {}),
  };
}

export function buildWordOrderBy(sort: WordSort): Prisma.WordOrderByWithRelationInput {
  if (sort === "created_asc") {
    return { createdAt: "asc" };
  }

  if (sort === "alpha_asc") {
    return { displayText: "asc" };
  }

  // review_asc 需按一对多 schedule 的 nextReviewAt 排序，Prisma 无法对
  // to-many 关系子字段直接 orderBy，这里用 createdAt 兜底，调用方需用
  // sortWordsByNextReview 对结果做应用层排序。
  if (sort === "review_asc") {
    return { createdAt: "desc" };
  }

  return { createdAt: "desc" };
}

// 按「下次复习时间」升序的应用层排序（无复习计划的词排最后）。
export function sortWordsByNextReview<T extends { schedule: { nextReviewAt: Date }[] }>(items: T[]): T[] {
  return items.sort((a, b) => {
    const an = a.schedule[0]?.nextReviewAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bn = b.schedule[0]?.nextReviewAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return an - bn;
  });
}
