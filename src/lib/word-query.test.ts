import { describe, it, expect } from "vitest";
import {
  buildWordOrderBy,
  buildWordWhere,
  normalizeWordFilter,
  normalizeWordSort,
  sortWordsByNextReview,
} from "./word-query";

describe("normalizeWordFilter", () => {
  it("合法值原样返回", () => {
    expect(normalizeWordFilter("all")).toBe("all");
    expect(normalizeWordFilter("due")).toBe("due");
    expect(normalizeWordFilter("exam")).toBe("exam");
    expect(normalizeWordFilter("longSentence")).toBe("longSentence");
  });

  it("非法/空值回退 all", () => {
    expect(normalizeWordFilter(null)).toBe("all");
    expect(normalizeWordFilter("")).toBe("all");
    expect(normalizeWordFilter("hacking")).toBe("all");
    expect(normalizeWordFilter("  ")).toBe("all");
  });
});

describe("normalizeWordSort", () => {
  it("合法值原样返回", () => {
    expect(normalizeWordSort("created_desc")).toBe("created_desc");
    expect(normalizeWordSort("created_asc")).toBe("created_asc");
    expect(normalizeWordSort("review_asc")).toBe("review_asc");
    expect(normalizeWordSort("alpha_asc")).toBe("alpha_asc");
  });

  it("非法/空值回退 created_desc", () => {
    expect(normalizeWordSort(null)).toBe("created_desc");
    expect(normalizeWordSort("")).toBe("created_desc");
    expect(normalizeWordSort("random")).toBe("created_desc");
  });
});

describe("buildWordWhere", () => {
  it("无搜索词无筛选 → 仅含基础结构", () => {
    const where = buildWordWhere("", "all");
    expect(where.OR).toBeUndefined();
    expect(where.schedule).toBeUndefined();
    expect(where.sources).toBeUndefined();
  });

  it("搜索词生成 displayText/lemma/meaningZh 三路 OR", () => {
    const where = buildWordWhere("abandon", "all");
    expect(where.OR).toHaveLength(3);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayText: { contains: "abandon" } }),
        expect.objectContaining({ lemma: { contains: "abandon" } }),
        expect.objectContaining({ meaningZh: { contains: "abandon" } }),
      ]),
    );
  });

  it("due 筛选 → schedule some nextReviewAt lte", () => {
    const where = buildWordWhere("", "due");
    expect(where.schedule).toMatchObject({ some: { nextReviewAt: { lte: expect.any(Date) } } });
  });

  it("来源筛选（如 exam）→ sources some sourceType", () => {
    const where = buildWordWhere("", "exam");
    expect(where.sources).toEqual({ some: { sourceType: "exam" } });
  });
});

describe("buildWordOrderBy", () => {
  it("各排序映射到对应 Prisma 字段", () => {
    expect(buildWordOrderBy("created_desc")).toEqual({ createdAt: "desc" });
    expect(buildWordOrderBy("created_asc")).toEqual({ createdAt: "asc" });
    expect(buildWordOrderBy("alpha_asc")).toEqual({ displayText: "asc" });
    // review_asc 用 createdAt 兜底，需调用方做应用层排序
    expect(buildWordOrderBy("review_asc")).toEqual({ createdAt: "desc" });
  });
});

describe("sortWordsByNextReview", () => {
  const word = (id: string, next: Date | null) => ({
    id,
    schedule: next === null ? [] : [{ nextReviewAt: next }],
  });

  it("按 nextReviewAt 升序排列", () => {
    const a = word("a", new Date(2026, 8, 5));
    const b = word("b", new Date(2026, 8, 3));
    const c = word("c", new Date(2026, 8, 4));
    const sorted = sortWordsByNextReview([a, b, c]);
    expect(sorted.map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  it("无复习计划的词排在最后", () => {
    const a = word("a", new Date(2026, 8, 5));
    const none = word("none", null);
    const b = word("b", new Date(2026, 8, 1));
    const sorted = sortWordsByNextReview([a, none, b]);
    expect(sorted.map((w) => w.id)).toEqual(["b", "a", "none"]);
  });
});
