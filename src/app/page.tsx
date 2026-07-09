import Link from "next/link";
import { prisma } from "@/lib/db";

async function getHomeData() {
  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [
    totalWordsCount,
    dueCount,
    todayAddedCount,
    todayReviewedCount,
    recentWords,
    recentReviews,
    sourceDistribution,
  ] = await Promise.all([
    prisma.word.count(),
    prisma.reviewSchedule.count({
      where: { nextReviewAt: { lte: now } },
    }),
    prisma.word.count({
      where: { createdAt: { gte: startOfToday } },
    }),
    prisma.review.count({
      where: { reviewedAt: { gte: startOfToday, lt: endOfToday } },
    }),
    prisma.word.findMany({
      orderBy: { createdAt: "desc" },
      include: { sources: { orderBy: { createdAt: "desc" }, take: 1 } },
      take: 5,
    }),
    prisma.review.findMany({
      include: { word: true },
      orderBy: { reviewedAt: "desc" },
      take: 5,
    }),
    prisma.wordSource.groupBy({
      by: ["sourceType"],
      _count: { sourceType: true },
      orderBy: { _count: { sourceType: "desc" } },
    }),
  ]);

  return {
    totalWordsCount,
    dueCount,
    todayAddedCount,
    todayReviewedCount,
    recentWords,
    recentReviews,
    sourceDistribution,
  };
}

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题",
  reading: "阅读",
  lecture: "听课",
  manual: "手动",
  other: "其他",
};

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <main className="container fade-in">
      <div className="card stack">
        <h1 className="title">早安</h1>
        <p className="subtitle">今天还有 {data.dueCount} 个词等你复习。</p>

        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-label">总词条</span>
            <strong className="summary-value">{data.totalWordsCount}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">今日新增</span>
            <strong className="summary-value">{data.todayAddedCount}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">待复习</span>
            <strong className="summary-value">{data.dueCount}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">今日已复习</span>
            <strong className="summary-value">{data.todayReviewedCount}</strong>
          </div>
        </div>

        <div className="dashboard-note">
          {data.dueCount > 0
            ? `先完成 ${data.dueCount} 个待复习词，再补录今天遇到的新词。`
            : "今天没有到期词，趁现在录新词或回顾最近新增。"}
        </div>

        <div className="link-row">
          <Link href="/review" className="link-button">
            开始复习
          </Link>
          <Link href="/manual" className="link-button secondary">
            手动录词
          </Link>
          <Link href="/capture" className="link-button secondary">
            拍照录词
          </Link>
          <Link href="/words" className="link-button secondary">
            词库
          </Link>
          <Link href="/words?filter=due" className="link-button secondary">
            查看待复习词
          </Link>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <h2 className="section-title">来源分布</h2>

        {data.sourceDistribution.length === 0 ? (
          <p className="muted">录词后这里会显示你主要从哪里积累生词。</p>
        ) : (
          <div className="tag-grid">
            {data.sourceDistribution.map((item) => (
              <div key={item.sourceType} className="list-card">
                <strong>{SOURCE_LABELS[item.sourceType] || item.sourceType}</strong>
                <span className="muted">{item._count.sourceType} 条</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <h2 className="section-title">最近新增</h2>

        <div className="stack">
          {data.recentWords.length === 0 ? (
            <p className="muted">还没有词条，先去录入第一个词。</p>
          ) : (
            data.recentWords.map((word) => (
              <Link key={word.id} href={`/words/${word.id}`} className="list-card">
                <strong>{word.displayText}</strong>
                <div className="muted">{word.meaningZh || "暂无释义"}</div>
                {word.sources[0]?.sourceType ? (
                  <span className="muted">来源：{SOURCE_LABELS[word.sources[0].sourceType] || word.sources[0].sourceType}</span>
                ) : null}
              </Link>
            ))
          )}
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <h2 className="section-title">最近复习</h2>

        <div className="stack">
          {data.recentReviews.length === 0 ? (
            <p className="muted">还没有复习记录，先去完成今天的第一轮复习。</p>
          ) : (
            data.recentReviews.map((review) => (
              <div key={review.id} className="list-card">
                <strong>{review.word.displayText}</strong>
                <span className={`result-chip ${review.reviewResult}`}>
                  {review.reviewResult === "known" ? "认识" : review.reviewResult === "vague" ? "模糊" : "忘记"}
                </span>
                <span className="muted">
                  {new Date(review.reviewedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
