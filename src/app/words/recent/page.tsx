import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getRecentWords() {
  try {
    return await prisma.word.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        meanings: { orderBy: { sortOrder: "asc" }, take: 3 },
        sources: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  } catch (error) {
    console.error("recent words fetch failed:", error);
    return [];
  }
}

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题",
  reading: "阅读",
  lecture: "听课",
  manual: "手动",
  other: "其他",
};

export default async function RecentWordsPage() {
  const words = await getRecentWords();

  return (
    <main className="container fade-in">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <h1 className="section-title" style={{ margin: 0 }}>最近新增</h1>
        <Link href="/words" className="home-col-more">浏览词库 →</Link>
      </div>

      {words.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
            还没有词条，去录一个吧。
          </p>
        </div>
      ) : (
        <div className="stack">
          {words.map((word) => (
            <Link
              key={word.id}
              href={`/words/${word.id}`}
              className="list-card-recent"
            >
              <div className="list-card-left">
                <strong className="list-card-word-text">{word.displayText}</strong>
                {word.phonetic && (
                  <span className="list-card-phonetic">{word.phonetic}</span>
                )}
              </div>
              <div className="list-card-right">
                {word.meanings.length > 0 ? (
                  <span className="list-card-meaning-text">
                    {word.meanings.map((m) => m.meaningZh).join("；")}
                  </span>
                ) : word.meaningZh ? (
                  <span className="list-card-meaning-text">{word.meaningZh}</span>
                ) : null}
                {word.sources[0]?.sourceType && (
                  <span className="list-card-source">
                    {SOURCE_LABELS[word.sources[0].sourceType] || word.sources[0].sourceType}
                  </span>
                )}
              </div>
              <span className="list-card-arrow">→</span>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
        <Link href="/" className="link-button secondary">返回首页</Link>
      </div>
    </main>
  );
}
