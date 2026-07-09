import { Prisma, SourceType } from "@prisma/client";

export const SOURCE_FILTERS = ["exam", "reading", "lecture", "manual", "other"] as const;
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
            nextReviewAt: {
              lte: now,
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

  if (sort === "review_asc") {
    return { schedule: { nextReviewAt: "asc" } };
  }

  return { createdAt: "desc" };
}
