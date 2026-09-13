import { NextRequest, NextResponse } from "next/server";
import { buildWordOrderBy, buildWordWhere, normalizeWordFilter, normalizeWordSort, sortWordsByNextReview } from "@/lib/word-query";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";

function escapeCsvCell(value?: string | number | null) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // 防 CSV 公式注入：Excel/WPS 会把 = + - @ 开头的单元格当公式执行（=HYPERLINK/@import），
  // 前缀单引号强制按文本处理
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value?: Date | null) {
  return value ? value.toISOString() : "";
}

export async function GET(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const filter = normalizeWordFilter(searchParams.get("filter"));
    const sort = normalizeWordSort(searchParams.get("sort"));

    const items = await prisma.word.findMany({
      where: { userId, ...buildWordWhere(q, filter) },
      include: {
        schedule: { where: { userId } },
        sources: { orderBy: { createdAt: "desc" } },
      },
      orderBy: buildWordOrderBy(sort),
    });

    const ordered = sort === "review_asc" ? sortWordsByNextReview(items) : items;

    const header = [
      "displayText", "lemma", "meaningZh", "phonetic", "partOfSpeech",
      "exampleSentence", "note", "status", "sourceTypes", "sourceNotes",
      "nextReviewAt", "reviewCount", "intervalDays", "easeScore", "lastResult",
      "createdAt", "updatedAt",
    ];

    const rows = ordered.map((item) => [
      item.displayText, item.lemma, item.meaningZh, item.phonetic, item.partOfSpeech,
      item.exampleSentence, item.note, item.status,
      item.sources.map((s) => s.sourceType).join("; "),
      item.sources.map((s) => s.sourceNote || "").join("; "),
      formatDate(item.schedule[0]?.nextReviewAt),
      item.schedule[0]?.reviewCount ?? "",
      item.schedule[0]?.intervalDays ?? "",
      item.schedule[0]?.easeScore ?? "",
      item.schedule[0]?.lastResult ?? "",
      formatDate(item.createdAt), formatDate(item.updatedAt),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=vocabulary-export.csv",
      },
    });
  } catch (error) {
    console.error("export failed", error);
    return NextResponse.json({ message: "export failed" }, { status: 500 });
  }
}
